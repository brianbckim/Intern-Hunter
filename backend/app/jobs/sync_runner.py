import asyncio
import json
from pathlib import Path

import httpx

URL = "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/refs/heads/dev/.github/scripts/listings.json"

OUTPUT_PATH = Path("Backend/app/jobs/Intern-Hunter-Listing.json")


async def main() -> None:
    print("Fetching internship listings...")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(URL)
        resp.raise_for_status()
        data = resp.json()

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    OUTPUT_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Saved to: {OUTPUT_PATH}")
    print("Sync complete.")


if __name__ == "__main__":
    asyncio.run(main())