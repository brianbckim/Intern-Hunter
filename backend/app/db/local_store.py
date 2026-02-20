from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Any
from uuid import uuid4


_lock = Lock()
_store_path = Path(__file__).resolve().parents[2] / "data" / "dev_store.json"


def _read_store() -> dict[str, Any]:
    if not _store_path.exists():
        return {"users": [], "profiles": {}, "resumes": []}

    try:
        raw = json.loads(_store_path.read_text(encoding="utf-8"))
        users = raw.get("users", [])
        profiles = raw.get("profiles", {})
        if not isinstance(users, list):
            users = []
        if not isinstance(profiles, dict):
            profiles = {}
        resumes = raw.get("resumes", [])
        if not isinstance(resumes, list):
            resumes = []
        return {"users": users, "profiles": profiles, "resumes": resumes}
    except Exception:
        return {"users": [], "profiles": {}, "resumes": []}


def _write_store(data: dict[str, Any]) -> None:
    _store_path.parent.mkdir(parents=True, exist_ok=True)
    _store_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def get_user_by_email(email: str) -> dict[str, Any] | None:
    normalized = email.strip().lower()
    with _lock:
        store = _read_store()
        for user in store["users"]:
            if str(user.get("email", "")).lower() == normalized:
                return user
    return None


def create_user(doc: dict[str, Any]) -> None:
    with _lock:
        store = _read_store()
        store["users"].append(doc)
        _write_store(store)


def get_profile(user_email: str) -> dict[str, Any] | None:
    with _lock:
        store = _read_store()
        value = store["profiles"].get(user_email)
        if isinstance(value, dict):
            return value
    return None


def upsert_profile(user_email: str, profile_doc: dict[str, Any]) -> None:
    with _lock:
        store = _read_store()
        store["profiles"][user_email] = profile_doc
        _write_store(store)


def create_resume(doc: dict[str, Any]) -> str:
    with _lock:
        store = _read_store()
        resume_id = uuid4().hex
        item = {"resume_id": resume_id, **doc}
        store["resumes"].append(item)
        _write_store(store)
        return resume_id


def list_resumes_by_user(user_email: str, limit: int = 20) -> list[dict[str, Any]]:
    normalized = user_email.strip().lower()
    with _lock:
        store = _read_store()
        rows = [
            dict(item)
            for item in store["resumes"]
            if str(item.get("user_email", "")).lower() == normalized
        ]

    rows.sort(key=lambda item: str(item.get("uploaded_at", "")), reverse=True)
    return rows[:limit]


def get_resume_by_id_for_user(resume_id: str, user_email: str) -> dict[str, Any] | None:
    normalized = user_email.strip().lower()
    with _lock:
        store = _read_store()
        for item in store["resumes"]:
            if (
                str(item.get("resume_id", "")) == resume_id
                and str(item.get("user_email", "")).lower() == normalized
            ):
                return dict(item)
    return None


def update_resume_by_id_for_user(resume_id: str, user_email: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    normalized = user_email.strip().lower()
    with _lock:
        store = _read_store()
        for index, item in enumerate(store["resumes"]):
            if (
                str(item.get("resume_id", "")) == resume_id
                and str(item.get("user_email", "")).lower() == normalized
            ):
                updated = {**item, **updates}
                store["resumes"][index] = updated
                _write_store(store)
                return dict(updated)
    return None
