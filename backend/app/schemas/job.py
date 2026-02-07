from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class JobListing(BaseModel):
    """Normalized job listing record (from external API or demo list)."""

    source: str = Field(description="Origin of the listing (e.g., external|demo)")
    external_id: str = Field(min_length=1, max_length=200, description="Stable id within the source")

    title: str = Field(min_length=1, max_length=300)
    company: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    url: str | None = Field(default=None, max_length=2000)
    description: str | None = Field(default=None, max_length=20000)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
