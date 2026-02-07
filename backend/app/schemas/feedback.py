from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class ResumeFeedback(BaseModel):
    """AI-generated feedback snapshot for a resume."""

    user_email: str = Field(min_length=3, max_length=320)

    # Optional reference to a stored resume document (Mongo _id as string, etc.)
    resume_id: str | None = Field(default=None, max_length=50)

    summary: str | None = Field(default=None, max_length=5000)
    strong_points: list[str] = Field(default_factory=list, max_length=100)
    areas_to_improve: list[str] = Field(default_factory=list, max_length=100)
    suggested_edits: list[str] = Field(default_factory=list, max_length=200)
    skill_gaps: list[str] = Field(default_factory=list, max_length=100)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # User-controlled notes ("Save Notes")
    saved_notes: str | None = Field(default=None, max_length=10000)
