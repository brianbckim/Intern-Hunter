from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user_email
from app.db.collections import profiles_collection
from app.db.local_store import get_profile as get_local_profile
from app.db.local_store import upsert_profile as upsert_local_profile
from app.db.mongo import get_database
from app.schemas.profile import UserProfile, UserProfileUpdate


router = APIRouter(prefix="/profile")


@router.get("/me", response_model=UserProfile)
async def get_my_profile(user_email: str = Depends(get_current_user_email)) -> UserProfile:
    db = get_database()

    if db is None:
        doc = get_local_profile(user_email)
    else:
        profiles = profiles_collection(db)
        doc = await profiles.find_one({"user_email": user_email})

    if doc is None:
        profile = UserProfile(user_email=user_email)
        if db is None:
            upsert_local_profile(user_email, profile.model_dump(mode="json"))
        else:
            profiles = profiles_collection(db)
            await profiles.insert_one(profile.model_dump())
        return profile

    if isinstance(doc, dict):
        doc.pop("_id", None)
    return UserProfile(**doc)


@router.put("/me", response_model=UserProfile)
async def upsert_my_profile(
    payload: UserProfileUpdate,
    user_email: str = Depends(get_current_user_email),
) -> UserProfile:
    db = get_database()

    profile = UserProfile(
        user_email=user_email,
        name=payload.name,
        major_or_program=payload.major_or_program,
        career_interests=payload.career_interests,
        skills=payload.skills,
        graduation_year=payload.graduation_year,
        updated_at=datetime.now(timezone.utc),
    )

    if db is None:
        upsert_local_profile(user_email, profile.model_dump(mode="json"))
    else:
        profiles = profiles_collection(db)
        await profiles.update_one(
            {"user_email": user_email},
            {"$set": profile.model_dump()},
            upsert=True,
        )
    return profile
