from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorDatabase


def users_collection(db: AsyncIOMotorDatabase):
    return db["users"]


def profiles_collection(db: AsyncIOMotorDatabase):
    return db["profiles"]


def resumes_collection(db: AsyncIOMotorDatabase):
    return db["resumes"]


def resume_feedback_collection(db: AsyncIOMotorDatabase):
    return db["resume_feedback"]


def jobs_collection(db: AsyncIOMotorDatabase):
    return db["jobs"]


def applications_collection(db: AsyncIOMotorDatabase):
    return db["applications"]
