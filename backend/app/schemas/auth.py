from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.utils.time import now_eastern


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=200)
    created_at: datetime = Field(default_factory=now_eastern)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
