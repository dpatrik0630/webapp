import os
import httpx
from fastapi import APIRouter, HTTPException
from dotenv import load_dotenv

load_dotenv()

WEATHER_API_KEY = "355e4ef8780d4449ad2115514252504"
WEATHER_URL = "http://api.weatherapi.com/v1/current.json"

weather_router = APIRouter()
db_pool = None

def set_db_pool(pool):
    global db_pool
    db_pool = pool

@weather_router.get("/api/weather/{plant_id}")
async def get_weather(plant_id: int):
    async with db_pool.acquire() as conn:
        plant = await conn.fetchrow("SELECT location FROM plants WHERE id = $1", plant_id)
        if not plant or not plant["location"]:
            raise HTTPException(status_code=404, detail="Plant or location not found")

        city = plant["location"]

    params = {
        "key": WEATHER_API_KEY,
        "q": city,
        "lang": "hu"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(WEATHER_URL, params=params)

    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="Weather API error")

    data = response.json()

    return {
        "temperature": data["current"]["temp_c"],
        "condition": data["current"]["condition"]["text"],
        "icon": data["current"]["condition"]["icon"]
    }
