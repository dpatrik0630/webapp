from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, APIRouter, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from smartlogger_alarms import alarm_definitions
from collections import Counter
import asyncpg
import asyncio
from datetime import datetime, timedelta, timezone, time
from auth import auth_router, set_db_pool, get_current_user
from weather import weather_router, set_db_pool as set_weather_pool
from zoneinfo import ZoneInfo
from pydantic import BaseModel


app = FastAPI()
router = APIRouter()

app.include_router(auth_router)
app.include_router(weather_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://100.94.37.110:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db_pool = None

@app.on_event("startup")
async def startup():
    global db_pool
    db_pool = await asyncpg.create_pool(
        database="aramut",
        user="postgres",
        password="mj46-pr23",
        host="100.115.164.70",
        port="5432",
        min_size=1,
        max_size=10
    )
    set_db_pool(db_pool)
    set_weather_pool(db_pool)

@app.on_event("shutdown")
async def shutdown():
    await db_pool.close()

active_connections = set()

@router.get("/api/plant/{plant_id}/hourly-avg")
async def get_string_hourly_avg(plant_id: int):
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT inverter_id, string_number, hourly_avg_power, calculation_hour, calculation_date
            FROM string_weekly_hourly_avg
            WHERE plant_id = $1
            ORDER BY calculation_date DESC, calculation_hour DESC
            LIMIT 168  -- 7 nap * 24 óra = 168 rekord
        """, plant_id)

    return [dict(row) for row in rows]

@app.websocket("/ws/plant/{plant_id}/production")
async def websocket_production_data(websocket: WebSocket, plant_id: int):
    await websocket.accept()
    active_connections.add(websocket)

    try:
        while True:
            async with db_pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT timestamp, prod_power
                    FROM alteo_data
                    WHERE plant_id = $1
                    ORDER BY timestamp DESC
                    LIMIT 30
                """, plant_id)

                production_data = [
                    {"timestamp": row["timestamp"].isoformat(), "prod_power": row["prod_power"]}
                    for row in rows
                ]

            await websocket.send_json(production_data)
            await asyncio.sleep(1)

    except WebSocketDisconnect:
        active_connections.remove(websocket)



@app.get("/api/plants")
async def get_plants(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    role = current_user["role"]
    async with db_pool.acquire() as conn:
        if role == "admin":
            query = """
                SELECT
                    p.id,
                    p.name,
                    MAX(pd.timestamp) AS last_updated
                FROM plants p
                LEFT JOIN logger_data pd ON pd.plant_id = p.id
                GROUP BY p.id, p.name
                ORDER BY p.name;
            """
            rows = await conn.fetch(query)
        else:
            query = """
                SELECT
                    p.id,
                    p.name,
                    MAX(pd.timestamp) AS last_updated
                FROM plants p
                JOIN user_plant_access upa ON upa.plant_id = p.id
                LEFT JOIN logger_data pd ON pd.plant_id = p.id
                WHERE upa.user_id = $1
                GROUP BY p.id, p.name
                ORDER BY p.name;
            """
            rows = await conn.fetch(query, user_id)

    return [
        {
            "id": row["id"],
            "name": row["name"],
            "last_updated": row["last_updated"].isoformat() if row["last_updated"] else None
        }
        for row in rows
    ]



@app.get("/api/plant/{plant_id}/alarms/active")
async def get_active_alarms(plant_id: int, current_user: dict = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT register, bit, last_updated
            FROM logger_alarm_status
            WHERE plant_id = $1 AND is_active = TRUE
        """, plant_id)

    result = []
    for row in rows:
        key = (row["register"], row["bit"])
        alarm = alarm_definitions.get(key)
        result.append({
            "register": row["register"],
            "bit": row["bit"],
            "last_updated": row["last_updated"],
            "alarm_id": alarm.get("alarm_id") if alarm else None,
            "alarm_name": alarm.get("alarm_name", "Ismeretlen riasztás") if alarm else "Ismeretlen",
            "severity": alarm.get("severity", "Unknown") if alarm else "Unknown"
        })
    return result


@app.get("/api/plant/{plant_id}/alarms/summary")
async def get_alarm_summary(plant_id: int, current_user: dict = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT register, bit
            FROM logger_alarm_status
            WHERE plant_id = $1 AND is_active = TRUE
        """, plant_id)

    severity_counter = Counter()
    for row in rows:
        key = (row["register"], row["bit"])
        alarm = alarm_definitions.get(key)
        if alarm:
            severity = alarm["severity"]
            if severity == "Adaptable":
                severity = "Warning"
            severity_counter[severity] += 1
    return severity_counter


@app.get("/api/plant/{plant_id}/alarms/history")
async def get_alarm_history(plant_id: int, current_user: dict = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT register, bit, event_type, timestamp
            FROM logger_alarm_log
            WHERE plant_id = $1
            ORDER BY timestamp DESC
            LIMIT 100
        """, plant_id)

    result = []
    for row in rows:
        key = (row["register"], row["bit"])
        alarm = alarm_definitions.get(key)
        result.append({
            "register": row["register"],
            "bit": row["bit"],
            "timestamp": row["timestamp"],
            "event_type": row["event_type"],
            "alarm_name": alarm.get("alarm_name", "Ismeretlen"),
            "severity": alarm.get("severity", "Unknown")
        })
    return result


@app.get("/api/plant/{plant_id}/production-data")
async def get_production_data(plant_id: int, date: str, current_user: dict = Depends(get_current_user)):
    local_tz = ZoneInfo("Europe/Budapest")
    local_date = datetime.strptime(date, "%Y-%m-%d").date()

    # Budapest nap eleje/vége → UTC → naiv (Postgres TIMESTAMP WITHOUT TIME ZONE-hoz)
    local_start = datetime.combine(local_date, time.min).replace(tzinfo=local_tz).astimezone(timezone.utc).replace(tzinfo=None)
    local_end   = datetime.combine(local_date, time.max).replace(tzinfo=local_tz).astimezone(timezone.utc).replace(tzinfo=None)

    async with db_pool.acquire() as conn:
        meter_rows = await conn.fetch("""
            SELECT timestamp, active_power
            FROM meter_data
            WHERE plant_id = $1
              AND timestamp BETWEEN $2 AND $3
            ORDER BY timestamp
        """, plant_id, local_start, local_end)

        logger_rows = await conn.fetch("""
            SELECT timestamp, active_power
            FROM logger_data
            WHERE plant_id = $1
              AND timestamp BETWEEN $2 AND $3
            ORDER BY timestamp
        """, plant_id, local_start, local_end)

    return {
        "consumption": [{"timestamp": r["timestamp"].isoformat(), "active_power": r["active_power"]} for r in meter_rows],
        "production":  [{"timestamp": r["timestamp"].isoformat(), "active_power": r["active_power"]} for r in logger_rows],
    }



@app.get("/api/plant/{plant_id}/inverter-data")
async def get_inverter_data(plant_id: int, current_user: dict = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT i.id AS inverter_id, i.name AS inverter_name, i.max_string_count, d.*
            FROM inverters i
            LEFT JOIN inverter_data d ON i.id = d.inverter_id
            WHERE i.plant_id = $1
            AND d.timestamp = (
                SELECT MAX(timestamp) FROM inverter_data WHERE inverter_id = i.id
            )
            ORDER BY i.id ASC;
        """, plant_id)

    return [dict(row) for row in rows]

@app.get("/api/plant/{plant_id}/logger-data")
async def get_logger_data(plant_id: int, current_user: dict = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        query = """
        SELECT * FROM logger_data
        WHERE plant_id = $1
        ORDER BY timestamp DESC
        LIMIT 1
        """
        row = await conn.fetchrow(query, plant_id)
        return dict(row) if row else {"error": "No data found"}

@app.get("/api/plant/{plant_id}/meter-data")
async def get_meter_data(plant_id: int, current_user: dict = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        query = """
        SELECT * FROM meter_data 
        WHERE plant_id = $1 
        ORDER BY timestamp DESC 
        LIMIT 1
        """
        row = await conn.fetchrow(query, plant_id)
        return dict(row) if row else {"error": "No data found"}
    
@app.get("/api/plant/{plant_id}/weekly-avg")
async def get_weekly_avg(plant_id: int, current_user: dict = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT string_number, hourly_avg_power 
            FROM string_weekly_hourly_avg
            WHERE plant_id = $1
            ORDER BY calculation_date DESC
        """, plant_id)
        
        return [dict(row) for row in rows]
    
@app.get("/api/plant/{plant_id}/inverter-performance")
async def get_inverter_performance(plant_id: int, current_user: dict = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT i.id AS inverter_id,
                   i.name AS inverter_name,
                   i.max_power,
                   d.active_power
            FROM inverters i
            JOIN LATERAL (
                SELECT active_power
                FROM inverter_data d
                WHERE d.inverter_id = i.id
                ORDER BY d.timestamp DESC
                LIMIT 1
            ) d ON true
            WHERE i.plant_id = $1;
        """, plant_id)

    performance = []
    for row in rows:
        max_power_kW = (row["max_power"] or 1) / 1000
        active_power = row["active_power"] or 0
        percent = round((active_power / max_power_kW) * 100 if max_power_kW else 0, 2)

        performance.append({
        "inverter_id": row["inverter_id"],
        "inverter_name": row["inverter_name"],
        "active_power": round(active_power, 2),
        "power_kwh": round(active_power, 2),
        "percent": round(percent, 2)
    })
    return performance

@app.get("/api/plant/{plant_id}/power-adjustment")
async def get_plant_power_adjustment_settings(plant_id: int, current_user: dict = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT price_control_enabled, price_threshold, min_power_limit
            FROM plants
            WHERE id = $1
        """, plant_id)
        if not row:
            raise HTTPException(status_code=404, detail="Plant not found.")
        return dict(row)
    
class PriceUpdate(BaseModel):
    price_threshold: float

@app.put("/api/plant/{plant_id}/power-adjustment")
async def update_price_threshold(plant_id: int, update: PriceUpdate, current_user: dict = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        await conn.execute("""
            UPDATE plants
            SET price_threshold = $1
            WHERE id = $2 AND price_control_enabled = true
        """, update.price_threshold, plant_id)
    return {"status": "ok", "new_price": update.price_threshold}


@app.get("/api/plant/{plant_id}/daily-yield-range")
async def get_daily_yield_range(
    plant_id: int,
    start_date: str = Query(...),
    end_date: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                date_trunc('day', timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Budapest') AS day,
                MAX(today_yield) as max_yield
            FROM logger_data
            WHERE plant_id = $1 AND timestamp BETWEEN $2 AND $3
            GROUP BY day
            ORDER BY day
        """, plant_id, start, end)

    return [
        {
            "date": row["day"].date().isoformat(),
            "yield": float(row["max_yield"]) if row["max_yield"] is not None else 0
        }
        for row in rows
    ]

@app.get("/api/string-health/latest")
async def get_latest_string_health(current_user: dict = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            WITH latest AS (
                SELECT MAX(check_hour) AS ts
                FROM inverter_string_health
            )
            SELECT
                p.id   AS plant_id,
                p.name AS plant_name,
                i.id   AS inverter_id,
                i.name AS inverter_name,
                i.slave_id,
                ish.string_index,
                ish.v,
                ish.a,
                ish.check_hour
            FROM inverter_string_health ish
            JOIN latest l          ON ish.check_hour = l.ts
            JOIN inverters i       ON i.id = ish.inverter_id
            JOIN plants p          ON p.id = i.plant_id
            ORDER BY p.name, i.name, ish.string_index;
        """)

    return [
        {
            "plant_id": r["plant_id"],
            "plant_name": r["plant_name"],
            "inverter_id": r["inverter_id"],
            "inverter_name": r["inverter_name"],
            "slave_id": r["slave_id"],
            "string_index": r["string_index"],
            "v": float(r["v"]) if r["v"] is not None else None,
            "a": float(r["a"]) if r["a"] is not None else None,
            "check_hour": r["check_hour"].isoformat() if isinstance(r["check_hour"], datetime) else r["check_hour"],
        }
        for r in rows
    ]