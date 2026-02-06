from __future__ import annotations

import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings


logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    global _client, _db

    if not settings.MONGODB_URI:
        logger.info("MongoDB disabled (MONGODB_URI not set)")
        _client = None
        _db = None
        return

    try:
        _client = AsyncIOMotorClient(settings.MONGODB_URI)
        _db = _client[settings.MONGODB_DB]
        await _db.command("ping")
        logger.info("MongoDB connected")
    except Exception as exc:  # noqa: BLE001
        logger.warning("MongoDB connection failed; continuing without DB: %s", exc)
        _client = None
        _db = None


async def disconnect_from_mongo() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


def get_database() -> Optional[AsyncIOMotorDatabase]:
    return _db
