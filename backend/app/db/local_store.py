from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime
from threading import Lock
from typing import Any
from uuid import uuid4

from app.utils.time import now_eastern


def _safe_parse_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return datetime.min
    return datetime.min


_lock = Lock()
_store_path = Path(__file__).resolve().parents[2] / "data" / "dev_store.json"


def _read_store() -> dict[str, Any]:
    if not _store_path.exists():
        return {"users": [], "profiles": {}, "resumes": [], "resume_feedback": [], "recommendations_snapshots": []}

    try:
        raw = json.loads(_store_path.read_text(encoding="utf-8"))
        users = raw.get("users", [])
        profiles = raw.get("profiles", {})
        resume_feedback = raw.get("resume_feedback", [])
        recommendations_snapshots = raw.get("recommendations_snapshots", [])
        if not isinstance(users, list):
            users = []
        if not isinstance(profiles, dict):
            profiles = {}
        resumes = raw.get("resumes", [])
        if not isinstance(resumes, list):
            resumes = []
        if not isinstance(resume_feedback, list):
            resume_feedback = []
        if not isinstance(recommendations_snapshots, list):
            recommendations_snapshots = []
        return {
            "users": users,
            "profiles": profiles,
            "resumes": resumes,
            "resume_feedback": resume_feedback,
            "recommendations_snapshots": recommendations_snapshots,
        }
    except Exception:
        return {"users": [], "profiles": {}, "resumes": [], "resume_feedback": [], "recommendations_snapshots": []}


def create_recommendations_snapshot(doc: dict[str, Any]) -> str:
    with _lock:
        store = _read_store()
        snapshot_id = uuid4().hex
        item = {"snapshot_id": snapshot_id, **doc}
        store.setdefault("recommendations_snapshots", []).append(item)
        _write_store(store)
        return snapshot_id


def list_recommendations_snapshots_by_user(user_email: str, limit: int = 20) -> list[dict[str, Any]]:
    normalized = user_email.strip().lower()
    with _lock:
        store = _read_store()
        rows = [
            dict(item)
            for item in store.get("recommendations_snapshots", [])
            if str(item.get("user_email", "")).lower() == normalized
        ]

    rows.sort(key=lambda item: _safe_parse_datetime(item.get("created_at")), reverse=True)
    return rows[:limit]


def get_latest_recommendations_snapshot_for_user(user_email: str, resume_id: str) -> dict[str, Any] | None:
    normalized = user_email.strip().lower()
    with _lock:
        store = _read_store()
        rows = [
            dict(item)
            for item in store.get("recommendations_snapshots", [])
            if str(item.get("user_email", "")).lower() == normalized and str(item.get("resume_id")) == str(resume_id)
        ]
    rows.sort(key=lambda item: _safe_parse_datetime(item.get("created_at")), reverse=True)
    return rows[0] if rows else None


def update_recommendations_snapshot_by_id_for_user(
    snapshot_id: str, user_email: str, updates: dict[str, Any]
) -> dict[str, Any] | None:
    normalized = user_email.strip().lower()
    with _lock:
        store = _read_store()
        items = store.get("recommendations_snapshots", [])
        for index, item in enumerate(items):
            if str(item.get("snapshot_id", "")) == snapshot_id and str(item.get("user_email", "")).lower() == normalized:
                updated = {**item, **updates}
                items[index] = updated
                store["recommendations_snapshots"] = items
                _write_store(store)
                return dict(updated)
    return None


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


def delete_user_by_email(email: str) -> bool:
    normalized = email.strip().lower()
    with _lock:
        store = _read_store()
        users = store["users"]
        found = False
        store["users"] = [
            u for u in users
            if str(u.get("email", "")).lower() != normalized or not (found := True)
        ]
        if not found:
            return False
        store["profiles"] = {
            k: v for k, v in store.get("profiles", {}).items()
            if k.lower() != normalized
        }
        store["resumes"] = [
            r for r in store.get("resumes", [])
            if str(r.get("user_email", "")).lower() != normalized
        ]
        store["resume_feedback"] = [
            f for f in store.get("resume_feedback", [])
            if str(f.get("user_email", "")).lower() != normalized
        ]
        store["recommendations_snapshots"] = [
            s for s in store.get("recommendations_snapshots", [])
            if str(s.get("user_email", "")).lower() != normalized
        ]
        _write_store(store)
        return True


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

    rows.sort(key=lambda item: _safe_parse_datetime(item.get("uploaded_at")), reverse=True)
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


def delete_resume_by_id_for_user(resume_id: str, user_email: str) -> dict[str, Any] | None:
    normalized = user_email.strip().lower()
    with _lock:
        store = _read_store()
        items = store.get("resumes", [])
        for index, item in enumerate(items):
            if (
                str(item.get("resume_id", "")) == resume_id
                and str(item.get("user_email", "")).lower() == normalized
            ):
                removed = dict(items.pop(index))
                store["resumes"] = items
                _write_store(store)
                return removed
    return None


def delete_resume_feedback_by_resume_id_for_user(resume_id: str, user_email: str) -> int:
    normalized = user_email.strip().lower()
    with _lock:
        store = _read_store()
        items = list(store.get("resume_feedback", []))
        kept: list[dict[str, Any]] = []
        removed = 0
        for item in items:
            if str(item.get("user_email", "")).lower() == normalized and str(item.get("resume_id")) == str(resume_id):
                removed += 1
            else:
                kept.append(item)
        store["resume_feedback"] = kept
        _write_store(store)
        return removed


def delete_recommendations_snapshots_by_resume_id_for_user(resume_id: str, user_email: str) -> int:
    normalized = user_email.strip().lower()
    with _lock:
        store = _read_store()
        items = list(store.get("recommendations_snapshots", []))
        kept: list[dict[str, Any]] = []
        removed = 0
        for item in items:
            if str(item.get("user_email", "")).lower() == normalized and str(item.get("resume_id")) == str(resume_id):
                removed += 1
            else:
                kept.append(item)
        store["recommendations_snapshots"] = kept
        _write_store(store)
        return removed


def create_resume_feedback(doc: dict[str, Any]) -> str:
    with _lock:
        store = _read_store()
        feedback_id = uuid4().hex
        item = {"feedback_id": feedback_id, **doc}
        store["resume_feedback"].append(item)
        _write_store(store)
        return feedback_id


def list_resume_feedback_by_user(user_email: str, limit: int = 20) -> list[dict[str, Any]]:
    normalized = user_email.strip().lower()
    with _lock:
        store = _read_store()
        rows = [
            dict(item)
            for item in store.get("resume_feedback", [])
            if str(item.get("user_email", "")).lower() == normalized
        ]

    rows.sort(key=lambda item: _safe_parse_datetime(item.get("created_at")), reverse=True)
    return rows[:limit]


def get_resume_feedback_by_id_for_user(feedback_id: str, user_email: str) -> dict[str, Any] | None:
    normalized = user_email.strip().lower()
    with _lock:
        store = _read_store()
        for item in store.get("resume_feedback", []):
            if (
                str(item.get("feedback_id", "")) == feedback_id
                and str(item.get("user_email", "")).lower() == normalized
            ):
                return dict(item)
    return None


def update_resume_feedback_notes_by_id_for_user(
    feedback_id: str, user_email: str, saved_notes: str | None
) -> dict[str, Any] | None:
    normalized = user_email.strip().lower()
    with _lock:
        store = _read_store()
        items = store.get("resume_feedback", [])
        for index, item in enumerate(items):
            if (
                str(item.get("feedback_id", "")) == feedback_id
                and str(item.get("user_email", "")).lower() == normalized
            ):
                note_text = (saved_notes or "").strip()
                if not note_text:
                    updated = {**item, "saved_notes": None}
                    items[index] = updated
                    store["resume_feedback"] = items
                    _write_store(store)
                    return dict(updated)

                history = item.get("notes_history")
                if not isinstance(history, list):
                    history = []

                history.append({"created_at": now_eastern().isoformat(), "text": note_text})
                updated = {**item, "saved_notes": note_text, "notes_history": history}
                items[index] = updated
                store["resume_feedback"] = items
                _write_store(store)
                return dict(updated)
    return None
