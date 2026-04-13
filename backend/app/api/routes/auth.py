from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.collections import users_collection
from app.db.local_store import create_user as create_local_user
from app.db.local_store import delete_user_by_email as delete_local_user_by_email
from app.db.local_store import get_user_by_email as get_local_user_by_email
from app.db.local_store import update_user_password as update_local_user_password
from app.db.mongo import get_database
from app.api.deps import get_current_user_email
from app.schemas.auth import ChangePasswordRequest, LoginRequest, RegisterRequest, TokenResponse


router = APIRouter(prefix="/auth")


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest) -> TokenResponse:
    db = get_database()

    existing = None
    if db is None:
        existing = get_local_user_by_email(payload.email.lower())
    else:
        users = users_collection(db)
        existing = await users.find_one({"email": payload.email.lower()})

    if existing is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    doc = {
        "email": payload.email.lower(),
        "full_name": payload.full_name,
        "password_hash": hash_password(payload.password),
        "created_at": payload.created_at.isoformat(),
    }
    if db is None:
        create_local_user(doc)
    else:
        users = users_collection(db)
        await users.insert_one(doc)

    token = create_access_token(
        subject=payload.email.lower(),
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return TokenResponse(access_token=token, token_type="bearer")


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> TokenResponse:
    db = get_database()

    if db is None:
        user = get_local_user_by_email(payload.email.lower())
    else:
        users = users_collection(db)
        user = await users.find_one({"email": payload.email.lower()})

    if user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(
        subject=payload.email.lower(),
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return TokenResponse(access_token=token, token_type="bearer")


@router.put("/password", status_code=status.HTTP_200_OK)
async def change_password(
    payload: ChangePasswordRequest,
    current_user_email: str = Depends(get_current_user_email),
) -> dict[str, str]:
    db = get_database()

    if db is None:
        user = get_local_user_by_email(current_user_email)
    else:
        users = users_collection(db)
        user = await users.find_one({"email": current_user_email})

    if user is None:
        raise HTTPException(status_code=404, detail="Account not found")

    if not verify_password(payload.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    new_hash = hash_password(payload.new_password)

    if db is None:
        update_local_user_password(current_user_email, new_hash)
    else:
        users = users_collection(db)
        await users.update_one(
            {"email": current_user_email},
            {"$set": {"password_hash": new_hash}},
        )

    return {"detail": "Password updated successfully"}


@router.delete("/account", status_code=status.HTTP_200_OK)
async def delete_account(
    current_user_email: str = Depends(get_current_user_email),
) -> dict[str, str]:
    db = get_database()

    if db is None:
        deleted = delete_local_user_by_email(current_user_email)
    else:
        users = users_collection(db)
        result = await users.delete_one({"email": current_user_email})
        deleted = result.deleted_count > 0

    if not deleted:
        raise HTTPException(status_code=404, detail="Account not found")

    return {"detail": "Account deleted successfully"}
