from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class ApplicationStatus(str, Enum):
    saved = "saved"
    applied = "applied"
    interview = "interview"
    rejected = "rejected"
    offer = "offer"


class JobApplication(BaseModel):
    """Application tracking record for the kanban board."""

    user_email: str = Field(min_length=3, max_length=320)

    job_source: str = Field(min_length=1, max_length=50)
    job_external_id: str = Field(min_length=1, max_length=200)

    status: ApplicationStatus = ApplicationStatus.saved
    notes: str | None = Field(default=None, max_length=5000)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
