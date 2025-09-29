import asyncio
from datetime import datetime
from main import db_pool
import asyncpg
import os

db_pool = None

async def init_db():
    global db_pool
    if db_pool is None:
        db_pool = await asyncpg.create_pool(
            database="alteo_server",
            user="postgres",
            password="mj46-pr23",
            host="localhost",
            port="5434",
            min_size=1,
            max_size=10
        )

async def calculate_weekly_hourly_avg():
    await init_db()
    async with db_pool.acquire() as conn:
        inverters = await conn.fetch("""
            SELECT id, max_string_count FROM inverters;
        """)

        for inverter in inverters:
            inverter_id = inverter["id"]
            max_string_count = inverter["max_string_count"]

            voltage_fields = ", ".join([f"string_{i}_v" for i in range(1, max_string_count + 1)])
            current_fields = ", ".join([f"string_{i}_a" for i in range(1, max_string_count + 1)])

            query = f"""
    INSERT INTO string_weekly_hourly_avg (
        plant_id,
        inverter_id,
        string_number,
        hourly_avg_power,
        calculation_hour,
        calculation_date
    )
    SELECT 
        plant_id,
        inverter_id,
        string_number,
        AVG(
            CASE
                WHEN voltage = 6553.5 OR current = 655.35 THEN NULL
                ELSE (voltage * current) / 1000
            END
        ) AS hourly_avg_power,
        calculation_hour,
        CURRENT_DATE AS calculation_date
    FROM (
        SELECT 
            i.plant_id,
            d.inverter_id,
            generate_series(1, {max_string_count}) AS string_number,
            unnest(ARRAY[{voltage_fields}]) AS voltage,
            unnest(ARRAY[{current_fields}]) AS current,
            DATE_TRUNC('hour', d.timestamp)::TIME AS calculation_hour
        FROM inverter_data d
        JOIN inverters i ON d.inverter_id = i.id
        WHERE d.inverter_id = {inverter_id} AND d.timestamp >= NOW() - INTERVAL '7 days'
    ) AS unnested_data
    GROUP BY plant_id, inverter_id, string_number, calculation_hour;
"""


            await conn.execute(query)
            print(f"[{datetime.now()}] Hourly averages calculated for inverter {inverter_id}.")

async def main():
    await calculate_weekly_hourly_avg()

if __name__ == "__main__":
    asyncio.run(main())
