from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class ResumeDocument(BaseModel):
    """Represents an uploaded resume and optional extracted text."""

    user_email: str = Field(min_length=3, max_length=320)

    original_filename: str = Field(min_length=1, max_length=500)
    content_type: str | None = Field(default=None, max_length=200)

    # Storage is intentionally abstracted for now (local file, S3, etc.)
    storage_ref: str | None = Field(default=None, max_length=2000)

    extracted_text: str | None = Field(default=None, max_length=200000)

    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    analyzed_at: datetime | None = None
