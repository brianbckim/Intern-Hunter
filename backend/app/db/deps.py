from __future__ import annotations

from fastapi import HTTPException

from app.db.mongo import get_database


def require_db():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="MongoDB is not configured or not connected")
    return db
