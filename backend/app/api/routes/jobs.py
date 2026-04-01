from fastapi import APIRouter

from app.jobs.listing_loader import list_visible_jobs

router = APIRouter()


@router.get("/")
@router.get("/")
async def get_jobs():
    result = []
    for item in list_visible_jobs(limit=500):
        result.append({
            "uid": item.uid,
            "external_id": item.external_id,
            "title": item.title,
            "company": item.company,
            "location": item.location,
            "url": item.url,
            "date_posted": item.date_posted,
            "category": item.category,
            "sponsorship": item.sponsorship,
            "source": item.source,
        })
    return result

