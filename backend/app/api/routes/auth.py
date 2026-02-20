from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.collections import users_collection
from app.db.local_store import create_user as create_local_user
from app.db.local_store import get_user_by_email as get_local_user_by_email
from app.db.mongo import get_database
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse


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
