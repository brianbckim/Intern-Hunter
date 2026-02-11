import asyncio
import httpx
import os

from motor.motor_asyncio import AsyncIOMotorClient

URL = "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/refs/heads/dev/.github/scripts/listings.json"

async def main():
    mongo_uri = os.environ["MONGODB_URI"]
    mongo_db = os.environ["MONGODB_DB"]

    client = AsyncIOMotorClient(mongo_uri)
    db = client[mongo_db]

    async with httpx.AsyncClient() as http:
        resp = await http.get(URL)
        data = resp.json()

    jobs = data.get("internships", [])

    for job in jobs:
        await db["jobs"].update_one(
            {
                "source": "simplify",
                "external_id": job.get("id")
            },
            {
                "$set": job
            },
            upsert=True
        )

    print("Sync complete")

if __name__ == "__main__":
    asyncio.run(main())
