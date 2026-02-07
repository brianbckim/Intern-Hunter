from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase


def users_collection(db: AsyncIOMotorDatabase):
    return db["users"]
