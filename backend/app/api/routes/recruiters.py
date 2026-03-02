from __future__ import annotations

import csv
import math
from pathlib import Path
from threading import Lock
from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel


router = APIRouter(prefix="/recruiters")


class RecruiterItem(BaseModel):
    name: str | None = None
    locality: str | None = None
    country: str | None = None
    region: str | None = None
    linkedin_url: str | None = None
    website: str | None = None


class RecruiterSearchResponse(BaseModel):
    total: int
    page: int
    limit: int
    pages: int
    items: list[RecruiterItem]


_lock = Lock()
_cached_mtime: float | None = None
_cached_rows: list[RecruiterItem] | None = None


def _csv_path() -> Path:
    return Path(__file__).resolve().parents[4] / "list_of_staffing_and_recruiter_businesses.csv"


def _normalize(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _load_rows() -> list[RecruiterItem]:
    path = _csv_path()
    if not path.exists():
        return []

    rows: list[RecruiterItem] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            rows.append(
                RecruiterItem(
                    name=_normalize(row.get("name")),
                    locality=_normalize(row.get("locality")),
                    country=_normalize(row.get("country")),
                    region=_normalize(row.get("region")),
                    linkedin_url=_normalize(row.get("linkedin_url")),
                    website=_normalize(row.get("website")),
                )
            )
    return rows


def _list_rows() -> list[RecruiterItem]:
    path = _csv_path()
    mtime = path.stat().st_mtime if path.exists() else None

    global _cached_mtime, _cached_rows
    with _lock:
        if mtime is not None and _cached_mtime == mtime and _cached_rows is not None:
            return _cached_rows
        rows = _load_rows()
        _cached_rows = rows
        _cached_mtime = mtime
        return rows


def _normalize_filter(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip().lower()
    return text or None


def _matches(field_value: str | None, needle: str | None) -> bool:
    if not needle:
        return True
    if not field_value:
        return False
    return needle in field_value.lower()


@router.get("/search", response_model=RecruiterSearchResponse)
async def search_recruiters(
    name: str | None = Query(default=None),
    locality: str | None = Query(default=None),
    country: str | None = Query(default=None),
    region: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=200),
) -> RecruiterSearchResponse:
    name_filter = _normalize_filter(name)
    locality_filter = _normalize_filter(locality)
    country_filter = _normalize_filter(country)
    region_filter = _normalize_filter(region)

    rows = _list_rows()
    filtered: list[RecruiterItem] = []
    for row in rows:
        if not _matches(row.name, name_filter):
            continue
        if not _matches(row.locality, locality_filter):
            continue
        if not _matches(row.country, country_filter):
            continue
        if not _matches(row.region, region_filter):
            continue
        filtered.append(row)

    total = len(filtered)
    pages = max(1, math.ceil(total / limit)) if total else 1
    start = (page - 1) * limit
    end = start + limit
    items = filtered[start:end]

    return RecruiterSearchResponse(
        total=total,
        page=page,
        limit=limit,
        pages=pages,
        items=items,
    )
