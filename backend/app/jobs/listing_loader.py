from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any


@dataclass(frozen=True)
class NormalizedJob:
    uid: str
    source: str
    external_id: str

    title: str | None
    company: str | None
    location: str | None
    url: str | None
    category: str | None
    sponsorship: str | None
    date_posted: int | None


_lock = Lock()
_cached_mtime: float | None = None
_cached_visible_jobs: list[NormalizedJob] | None = None


def _data_path() -> Path:
    return Path(__file__).resolve().parent / "Intern-Hunter-Listing.json"


def _load_raw() -> list[dict[str, Any]]:
    path = _data_path()
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as f:
            value = json.load(f)
        return value if isinstance(value, list) else []
    except Exception:
        return []


def _as_str(value: object) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def _as_int(value: object) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    try:
        return int(value)
    except Exception:
        return None


def _as_location(value: object) -> str | None:
    if not isinstance(value, list):
        return None
    parts = [str(v).strip() for v in value if str(v).strip()]
    return ", ".join(parts) if parts else None


def _normalize(item: dict[str, Any]) -> NormalizedJob:
    source = _as_str(item.get("source")) or ""
    external_id = _as_str(item.get("id")) or ""
    uid = f"{source}:{external_id}" if source and external_id else external_id

    return NormalizedJob(
        uid=uid,
        source=source,
        external_id=external_id,
        title=_as_str(item.get("title")),
        company=_as_str(item.get("company_name")),
        location=_as_location(item.get("locations")),
        url=_as_str(item.get("url")),
        category=_as_str(item.get("category")),
        sponsorship=_as_str(item.get("sponsorship")),
        date_posted=_as_int(item.get("date_posted")),
    )


def list_visible_jobs(*, limit: int = 5000) -> list[NormalizedJob]:
    """Return normalized visible jobs, newest-first, with lightweight caching.

    The listing JSON is frequently updated by a GitHub Actions bot.
    This loader uses file mtime to refresh cache when the file changes.
    """

    if limit < 1:
        return []

    path = _data_path()
    mtime = path.stat().st_mtime if path.exists() else None

    global _cached_mtime, _cached_visible_jobs
    with _lock:
        if mtime is not None and _cached_mtime == mtime and _cached_visible_jobs is not None:
            return _cached_visible_jobs[:limit]

        raw = _load_raw()
        visible = [item for item in raw if isinstance(item, dict) and item.get("is_visible")]
        visible.sort(key=lambda x: int(x.get("date_posted") or 0), reverse=True)

        normalized = [_normalize(item) for item in visible]
        _cached_mtime = mtime
        _cached_visible_jobs = normalized
        return normalized[:limit]
