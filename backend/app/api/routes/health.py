from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.db.mongo import get_database


router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/health/db")
async def health_db() -> dict:
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="MongoDB is not configured or not connected")
    try:
        await db.command("ping")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"MongoDB ping failed: {exc}")
    return {"status": "ok", "mongo": "connected"}
