from fastapi import APIRouter
from pathlib import Path
import json

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "jobs" / "Intern-Hunter-Listing.json"


@router.get("/")
@router.get("/")
async def get_jobs():
    if not DATA_PATH.exists():
        return []

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    visible_jobs = [j for j in raw_data if j.get("is_visible")]
    visible_jobs.sort(key=lambda x: x.get("date_posted", 0), reverse=True)
    visible_jobs = visible_jobs[:500]
    result = []
    for item in visible_jobs:
        result.append({
            "external_id": str(item.get("id")),
            "title": item.get("title"),
            "company": item.get("company_name"),
            "location": ", ".join(item.get("locations", [])),
            "url": item.get("url"),
            "date_posted": item.get("date_posted"),
            "category": item.get("category"),
            "sponsorship": item.get("sponsorship"),
            "source": item.get("source"),
        })
    return result

