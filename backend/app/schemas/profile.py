from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    """User-entered profile info used for recommendations and personalization."""

    user_email: str = Field(min_length=3, max_length=320)

    name: str | None = Field(default=None, max_length=200)
    major_or_program: str | None = Field(default=None, max_length=200)
    career_interests: str | None = Field(default=None, max_length=500)
    skills: list[str] = Field(default_factory=list, max_length=100)
    graduation_year: int | None = Field(default=None, ge=1900, le=2100)

    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
