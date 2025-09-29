import schedule
import time
import asyncio
from calculate_inverters_hourly_avg import calculate_weekly_hourly_avg, init_db

async def run_task():
    print("⚡ Initializing database connection...")
    await init_db()
    print("⚡ Running scheduled hourly average calculation...")
    await calculate_weekly_hourly_avg()
    print("✅ Calculation complete.")

schedule.every().day.at("02:00").do(lambda: asyncio.run(run_task()))

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "run_now":
        print("🔄 Manually triggered calculation...")
        asyncio.run(run_task())
    else:
        print("⏳ Waiting for the scheduled time...")
        while True:
            schedule.run_pending()
            time.sleep(60)
