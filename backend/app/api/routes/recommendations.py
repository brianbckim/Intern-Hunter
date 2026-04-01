from __future__ import annotations

import hashlib
import html
import json
import re
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
import httpx
from pydantic import BaseModel, Field

from app.ai.factory import get_ai_provider
from app.api.deps import get_current_user_email
from app.db.collections import profiles_collection, recommendations_snapshots_collection, resumes_collection, tailored_resume_snapshots_collection
from app.db.local_store import get_profile as get_local_profile
from app.db.local_store import list_resumes_by_user as list_local_resumes_by_user
from app.db.local_store import get_resume_by_id_for_user as get_local_resume_by_id_for_user
from app.db.local_store import (
    create_recommendations_snapshot as create_local_recommendations_snapshot,
    create_tailored_resume_snapshot as create_local_tailored_resume_snapshot,
    get_latest_recommendations_snapshot_for_user as get_local_latest_recommendations_snapshot_for_user,
    get_latest_tailored_resume_snapshot_for_user as get_local_latest_tailored_resume_snapshot_for_user,
    list_recommendations_snapshots_by_user,
    list_tailored_resume_snapshots_by_user,
    update_recommendations_snapshot_by_id_for_user as update_local_recommendations_snapshot_by_id_for_user,
    update_tailored_resume_snapshot_by_id_for_user as update_local_tailored_resume_snapshot_by_id_for_user,
)
from app.db.mongo import get_database
from app.utils.time import now_eastern
from app.jobs.listing_loader import get_visible_job_by_uid, list_visible_jobs
from app.core.config import settings
from app.schemas.profile import UserProfile
from app.services.recommendations import profile_summary, score_jobs_for_user


router = APIRouter(prefix="/recommendations")


class GenerateRecommendationsRequest(BaseModel):
    limit: int = Field(default=10, ge=1, le=50)
    candidate_pool: int = Field(default=40, ge=10, le=200)
    use_ai: bool = Field(default=True, description="If true, uses the configured AI provider to re-rank and summarize")
    resume_id: str | None = Field(default=None, description="Optional: include latest resume context for AI")


class RecommendedJobItem(BaseModel):
    uid: str
    source: str
    external_id: str
    title: str | None = None
    company: str | None = None
    location: str | None = None
    url: str | None = None
    category: str | None = None
    sponsorship: str | None = None
    date_posted: int | None = None
    score: float | None = None
    reason: str | None = None


class GenerateRecommendationsResponse(BaseModel):
    ai_used: bool = False
    career_summary: str | None = None
    recommended_roles: list[str] = Field(default_factory=list)
    recommended_skills: list[str] = Field(default_factory=list)
    jobs: list[RecommendedJobItem] = Field(default_factory=list)


class RecommendationsSnapshotStatus(BaseModel):
    status: str = Field(description="missing|pending|ready|error")
    snapshot_id: str | None = None
    resume_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    data: GenerateRecommendationsResponse | None = None
    error: str | None = None


class TailorResumeRequest(BaseModel):
    job_uid: str = Field(min_length=1)
    resume_id: str | None = Field(default=None)


class TailorResumeResponse(BaseModel):
    job_uid: str
    resume_id: str
    summary: str
    tailored_resume: str
    targeted_edits: list[str] = Field(default_factory=list)
    keywords_to_highlight: list[str] = Field(default_factory=list)


class TailorResumeSnapshotStatus(BaseModel):
    status: str = Field(description="missing|pending|ready|error")
    snapshot_id: str | None = None
    resume_id: str | None = None
    job_uid: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    data: TailorResumeResponse | None = None
    error: str | None = None


_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")


def _fallback_job_description_text(*, title: str, company: str | None, category: str | None, location: str | None, sponsorship: str | None) -> str:
    pieces = [
        f"Title: {title}",
        f"Company: {company or 'Unknown company'}",
        f"Category: {category or 'Unknown category'}",
        f"Location: {location or 'Unknown location'}",
        f"Sponsorship: {sponsorship or 'Unknown'}",
    ]
    return "\n".join(pieces)


def _html_to_text(value: str) -> str:
    cleaned = re.sub(r"(?is)<(script|style|noscript).*?>.*?</\1>", " ", value)
    cleaned = _HTML_TAG_RE.sub(" ", cleaned)
    cleaned = html.unescape(cleaned)
    cleaned = _WHITESPACE_RE.sub(" ", cleaned).strip()
    return cleaned


async def _fetch_job_description_text(url: str | None) -> str | None:
    if not url:
        return None
    try:
        headers = {"User-Agent": "InternHunter/1.0 (+resume-tailoring)"}
        timeout = httpx.Timeout(12.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=headers) as client:
            response = await client.get(url)
            response.raise_for_status()

        content_type = (response.headers.get("content-type") or "").lower()
        if "html" not in content_type and "text" not in content_type:
            return None

        text = _html_to_text(response.text)
        if len(text) < 200:
            return None
        return text[:5000]
    except Exception:
        return None


def _parse_datetime_or_none(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


async def _compute_tailored_resume(payload: TailorResumeRequest, user_email: str) -> TailorResumeResponse:
    resolved_resume_id = payload.resume_id or await _get_latest_resume_id_for_user(user_email)
    if not resolved_resume_id:
        raise HTTPException(status_code=404, detail="No resume found")

    resume_doc = await _get_resume_doc_for_user(resolved_resume_id, user_email)
    if not isinstance(resume_doc, dict):
        raise HTTPException(status_code=404, detail="Resume not found")

    extracted_text = resume_doc.get("extracted_text")
    if not isinstance(extracted_text, str) or not extracted_text.strip():
        raise HTTPException(status_code=400, detail="Resume text is not available for tailoring")

    job = get_visible_job_by_uid(payload.job_uid)
    if job is None:
        raise HTTPException(status_code=404, detail="Recommended job not found")

    fetched_job_description = await _fetch_job_description_text(job.url)
    job_description = fetched_job_description or _fallback_job_description_text(
        title=job.title or "Untitled role",
        company=job.company,
        category=job.category,
        location=job.location,
        sponsorship=job.sponsorship,
    )

    profile = await _get_profile_for_user(user_email)
    provider = get_ai_provider()
    tailored = await provider.tailor_resume_for_job(
        user_profile=profile_summary(profile),
        resume_text=extracted_text.strip()[:5000],
        job_title=job.title or "Untitled role",
        job_company=job.company,
        job_description=job_description,
    )

    return TailorResumeResponse(
        job_uid=job.uid,
        resume_id=str(resolved_resume_id),
        summary=tailored.summary,
        tailored_resume=tailored.tailored_resume,
        targeted_edits=list(tailored.targeted_edits),
        keywords_to_highlight=list(tailored.keywords_to_highlight),
    )


async def _compute_recommendations(payload: GenerateRecommendationsRequest, user_email: str) -> GenerateRecommendationsResponse:
    if payload.candidate_pool < payload.limit:
        raise HTTPException(status_code=400, detail="candidate_pool must be >= limit")

    jobs = list_visible_jobs(limit=5000)
    if not jobs:
        return GenerateRecommendationsResponse(ai_used=False, jobs=[])

    profile = await _get_profile_for_user(user_email)

    resume_text: str | None = None
    if payload.resume_id is not None or payload.use_ai:
        resume_id = payload.resume_id or await _get_latest_resume_id_for_user(user_email)
        if resume_id:
            doc = await _get_resume_doc_for_user(resume_id, user_email)
            if isinstance(doc, dict):
                extracted = doc.get("extracted_text")
                if isinstance(extracted, str) and extracted.strip():
                    resume_text = extracted.strip()[:4000]

    scored = score_jobs_for_user(
        jobs,
        profile=profile,
        resume_text=resume_text,
        limit=payload.candidate_pool,
    )
    candidates = scored

    response = GenerateRecommendationsResponse(ai_used=False)

    ranked_uids: list[str] = []
    reasons: dict[str, str] = {}
    ai_provider_name = (settings.AI_PROVIDER or "mock").strip().lower()
    if payload.use_ai and ai_provider_name != "mock":
        try:
            provider = get_ai_provider()
            ai = await provider.career_recommendations(
                user_profile=profile_summary(profile),
                resume_text=resume_text,
                candidate_jobs=[
                    {
                        "uid": c.job.uid,
                        "title": c.job.title or "",
                        "location": c.job.location or "",
                        "category": c.job.category or "",
                        "score": round(c.score, 3),
                        "matched_keywords": ", ".join(c.matched_keywords[:4]),
                    }
                    for c in candidates
                ],
                limit=payload.limit,
            )
            response.ai_used = True
            response.career_summary = ai.career_summary
            response.recommended_roles = list(ai.recommended_roles)
            response.recommended_skills = list(ai.recommended_skills)
            ranked_uids = list(ai.ranked_job_uids)
            reasons = dict(ai.job_reasons)
        except Exception:
            response.ai_used = False

    by_uid = {c.job.uid: c for c in candidates}

    ordered: list[str] = []
    for uid in ranked_uids:
        if uid in by_uid and uid not in ordered:
            ordered.append(uid)

    for c in candidates:
        if c.job.uid not in ordered:
            ordered.append(c.job.uid)
        if len(ordered) >= payload.limit:
            break

    out: list[RecommendedJobItem] = []
    for uid in ordered[: payload.limit]:
        c = by_uid.get(uid)
        if c is None:
            continue
        reason = reasons.get(uid)
        if not reason and c.matched_keywords:
            reason = f"Matched keywords: {', '.join(c.matched_keywords[:5])}"

        out.append(
            RecommendedJobItem(
                uid=c.job.uid,
                source=c.job.source,
                external_id=c.job.external_id,
                title=c.job.title,
                company=c.job.company,
                location=c.job.location,
                url=c.job.url,
                category=c.job.category,
                sponsorship=c.job.sponsorship,
                date_posted=c.job.date_posted,
                score=round(c.score, 4),
                reason=reason,
            )
        )

    response.jobs = out
    if response.career_summary is None and profile is not None:
        response.career_summary = profile_summary(profile)
    return response


async def _resolve_resume_id(payload: GenerateRecommendationsRequest, user_email: str) -> str | None:
    if payload.resume_id is not None:
        return payload.resume_id
    return await _get_latest_resume_id_for_user(user_email)


async def _save_snapshot_pending(
    *,
    user_email: str,
    resume_id: str,
    request_key: str,
    payload: GenerateRecommendationsRequest,
) -> tuple[str, datetime]:
    now = now_eastern()
    day_key = now.date().isoformat()
    db = get_database()
    doc = {
        "user_email": user_email,
        "resume_id": resume_id,
        "request_key": request_key,
        "status": "pending",
        "request": payload.model_dump(),
        "result": None,
        "error": None,
        "day_key": day_key,
        "created_at": now,
        "updated_at": now,
    }

    if db is None:
        snapshot_id = create_local_recommendations_snapshot(
            {
                **doc,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
        )
        return snapshot_id, now

    coll = recommendations_snapshots_collection(db)
    result = await coll.insert_one(doc)
    return str(result.inserted_id), now


def _snapshot_day_key(latest: dict[str, Any] | None) -> str | None:
    if not isinstance(latest, dict):
        return None
    day_key = latest.get("day_key")
    if isinstance(day_key, str) and day_key.strip():
        return day_key.strip()

    created_at = latest.get("created_at")
    if isinstance(created_at, datetime):
        try:
            aware = created_at if created_at.tzinfo is not None else created_at.replace(tzinfo=timezone.utc)
            return aware.astimezone(now_eastern().tzinfo).date().isoformat()
        except Exception:
            return None
    if isinstance(created_at, str):
        try:
            parsed = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            return parsed.astimezone(now_eastern().tzinfo).date().isoformat()
        except Exception:
            return None
    return None


def _snapshot_request_key(latest: dict[str, Any] | None) -> str | None:
    if not isinstance(latest, dict):
        return None
    value = latest.get("request_key")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


async def _load_latest_snapshot(*, user_email: str, resume_id: str) -> dict[str, Any] | None:
    db = get_database()
    if db is None:
        return get_local_latest_recommendations_snapshot_for_user(user_email, resume_id)

    coll = recommendations_snapshots_collection(db)
    return await coll.find_one(
        {"user_email": user_email, "resume_id": resume_id},
        sort=[("created_at", -1)],
    )


async def _load_latest_matching_snapshot(*, user_email: str, resume_id: str, request_key: str) -> dict[str, Any] | None:
    db = get_database()
    if db is None:
        rows = list_recommendations_snapshots_by_user(user_email, limit=50)
        for item in rows:
            if str(item.get("resume_id")) == str(resume_id) and str(item.get("request_key") or "") == request_key:
                return item
        return None

    coll = recommendations_snapshots_collection(db)
    return await coll.find_one(
        {"user_email": user_email, "resume_id": resume_id, "request_key": request_key},
        sort=[("created_at", -1)],
    )


def _build_request_key(*, payload: GenerateRecommendationsRequest, profile: UserProfile, resume_id: str, resume_text: str | None) -> str:
    request_doc = {
        "resume_id": resume_id,
        "limit": int(payload.limit),
        "candidate_pool": int(payload.candidate_pool),
        "use_ai": bool(payload.use_ai),
        "ai_provider": (settings.AI_PROVIDER or "mock").strip().lower(),
        "ai_model": (settings.OLLAMA_MODEL or "").strip(),
        "profile_summary": profile_summary(profile),
        "resume_excerpt": (resume_text or "")[:1500],
    }
    encoded = json.dumps(request_doc, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


async def _load_resume_text_for_user(resume_id: str | None, user_email: str) -> str | None:
    if not resume_id:
        return None
    doc = await _get_resume_doc_for_user(resume_id, user_email)
    if not isinstance(doc, dict):
        return None
    extracted = doc.get("extracted_text")
    if isinstance(extracted, str) and extracted.strip():
        return extracted.strip()[:4000]
    return None


async def _update_snapshot(
    *,
    snapshot_id: str,
    user_email: str,
    updates: dict[str, Any],
) -> None:
    db = get_database()
    if db is None:
        safe = dict(updates)
        for key in ("created_at", "updated_at"):
            if isinstance(safe.get(key), datetime):
                safe[key] = safe[key].isoformat()
        update_local_recommendations_snapshot_by_id_for_user(snapshot_id, user_email, safe)
        return

    coll = recommendations_snapshots_collection(db)
    try:
        oid = ObjectId(snapshot_id)
    except InvalidId:
        return
    await coll.update_one({"_id": oid, "user_email": user_email}, {"$set": updates})


async def _save_tailored_resume_snapshot_pending(
    *,
    user_email: str,
    resume_id: str,
    job_uid: str,
) -> tuple[str, datetime]:
    now = now_eastern()
    db = get_database()
    doc = {
        "user_email": user_email,
        "resume_id": resume_id,
        "job_uid": job_uid,
        "status": "pending",
        "result": None,
        "error": None,
        "created_at": now,
        "updated_at": now,
    }

    if db is None:
        snapshot_id = create_local_tailored_resume_snapshot(
            {
                **doc,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
        )
        return snapshot_id, now

    coll = tailored_resume_snapshots_collection(db)
    result = await coll.insert_one(doc)
    return str(result.inserted_id), now


async def _update_tailored_resume_snapshot(
    *,
    snapshot_id: str,
    user_email: str,
    updates: dict[str, Any],
) -> None:
    db = get_database()
    if db is None:
        safe = dict(updates)
        for key in ("created_at", "updated_at"):
            if isinstance(safe.get(key), datetime):
                safe[key] = safe[key].isoformat()
        update_local_tailored_resume_snapshot_by_id_for_user(snapshot_id, user_email, safe)
        return

    coll = tailored_resume_snapshots_collection(db)
    try:
        oid = ObjectId(snapshot_id)
    except InvalidId:
        return
    await coll.update_one({"_id": oid, "user_email": user_email}, {"$set": updates})


async def _load_latest_tailored_resume_snapshot(
    *,
    user_email: str,
    resume_id: str,
    job_uid: str,
) -> dict[str, Any] | None:
    db = get_database()
    if db is None:
        return get_local_latest_tailored_resume_snapshot_for_user(user_email, resume_id=resume_id, job_uid=job_uid)

    coll = tailored_resume_snapshots_collection(db)
    return await coll.find_one(
        {"user_email": user_email, "resume_id": resume_id, "job_uid": job_uid},
        sort=[("updated_at", -1), ("created_at", -1)],
    )


async def _list_latest_tailored_resume_snapshots(
    *,
    user_email: str,
    resume_id: str,
) -> list[dict[str, Any]]:
    db = get_database()
    if db is None:
        rows = list_tailored_resume_snapshots_by_user(user_email, resume_id=resume_id, limit=300)
    else:
        coll = tailored_resume_snapshots_collection(db)
        cursor = coll.find({"user_email": user_email, "resume_id": resume_id}).sort([("updated_at", -1), ("created_at", -1)]).limit(300)
        rows = []
        async for doc in cursor:
            rows.append(doc)

    latest_by_job: dict[str, dict[str, Any]] = {}
    for item in rows:
        job_uid = str(item.get("job_uid") or "").strip()
        if not job_uid or job_uid in latest_by_job:
            continue
        latest_by_job[job_uid] = item
    return list(latest_by_job.values())


def _tailored_resume_snapshot_to_status(doc: dict[str, Any]) -> TailorResumeSnapshotStatus:
    status = str(doc.get("status") or "missing")
    data = None
    if status == "ready" and isinstance(doc.get("result"), dict):
        data = TailorResumeResponse(**doc["result"])

    return TailorResumeSnapshotStatus(
        status=status,
        snapshot_id=str(doc.get("snapshot_id") or doc.get("_id")),
        resume_id=str(doc.get("resume_id") or "") or None,
        job_uid=str(doc.get("job_uid") or ""),
        created_at=_parse_datetime_or_none(doc.get("created_at")),
        updated_at=_parse_datetime_or_none(doc.get("updated_at")),
        data=data,
        error=str(doc.get("error") or "") or None,
    )


async def _run_tailored_resume_snapshot_job(
    *,
    snapshot_id: str,
    user_email: str,
    payload: TailorResumeRequest,
) -> None:
    try:
        result = await _compute_tailored_resume(payload, user_email)
        await _update_tailored_resume_snapshot(
            snapshot_id=snapshot_id,
            user_email=user_email,
            updates={
                "status": "ready",
                "result": result.model_dump(),
                "error": None,
                "updated_at": now_eastern(),
            },
        )
    except Exception as exc:
        await _update_tailored_resume_snapshot(
            snapshot_id=snapshot_id,
            user_email=user_email,
            updates={
                "status": "error",
                "error": str(exc)[:500],
                "updated_at": now_eastern(),
            },
        )


async def _run_snapshot_job(
    *,
    snapshot_id: str,
    user_email: str,
    payload: GenerateRecommendationsRequest,
) -> None:
    resume_id = await _resolve_resume_id(payload, user_email)
    if not resume_id:
        await _update_snapshot(
            snapshot_id=snapshot_id,
            user_email=user_email,
            updates={"status": "error", "error": "No resume found", "updated_at": now_eastern()},
        )
        return

    try:
        result = await _compute_recommendations(payload, user_email)
        await _update_snapshot(
            snapshot_id=snapshot_id,
            user_email=user_email,
            updates={
                "status": "ready",
                "result": result.model_dump(),
                "error": None,
                "updated_at": now_eastern(),
            },
        )
    except Exception as exc:
        await _update_snapshot(
            snapshot_id=snapshot_id,
            user_email=user_email,
            updates={
                "status": "error",
                "error": str(exc)[:500],
                "updated_at": now_eastern(),
            },
        )


async def _get_profile_for_user(user_email: str) -> UserProfile:
    db = get_database()
    if db is None:
        doc = get_local_profile(user_email)
        return UserProfile(**doc) if isinstance(doc, dict) else UserProfile(user_email=user_email)

    profiles = profiles_collection(db)
    doc = await profiles.find_one({"user_email": user_email})
    if not isinstance(doc, dict):
        return UserProfile(user_email=user_email)
    doc.pop("_id", None)
    return UserProfile(**doc)


async def _get_latest_resume_id_for_user(user_email: str) -> str | None:
    db = get_database()
    if db is None:
        rows = list_local_resumes_by_user(user_email=user_email, limit=1)
        return str(rows[0].get("resume_id")) if rows else None

    resumes = resumes_collection(db)
    doc = await resumes.find_one({"user_email": user_email}, sort=[("uploaded_at", -1)])
    if not doc:
        return None
    return str(doc.get("_id"))


async def _get_resume_doc_for_user(resume_id: str, user_email: str) -> dict[str, Any] | None:
    db = get_database()
    if db is None:
        return get_local_resume_by_id_for_user(resume_id=resume_id, user_email=user_email)

    resumes = resumes_collection(db)
    try:
        oid = ObjectId(resume_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid resume_id")

    return await resumes.find_one({"_id": oid, "user_email": user_email})


@router.post("/generate", response_model=GenerateRecommendationsResponse)
async def generate_recommendations(
    payload: GenerateRecommendationsRequest,
    user_email: str = Depends(get_current_user_email),
) -> GenerateRecommendationsResponse:
    return await _compute_recommendations(payload, user_email)


@router.post("/ensure", response_model=RecommendationsSnapshotStatus)
async def ensure_recommendations(
    payload: GenerateRecommendationsRequest,
    background_tasks: BackgroundTasks,
    user_email: str = Depends(get_current_user_email),
) -> RecommendationsSnapshotStatus:
    resume_id = await _resolve_resume_id(payload, user_email)
    if not resume_id:
        return RecommendationsSnapshotStatus(status="missing", snapshot_id=None, resume_id=None)

    profile = await _get_profile_for_user(user_email)
    resume_text = await _load_resume_text_for_user(resume_id, user_email)
    request_key = _build_request_key(payload=payload, profile=profile, resume_id=resume_id, resume_text=resume_text)

    latest = await _load_latest_matching_snapshot(user_email=user_email, resume_id=resume_id, request_key=request_key)
    if isinstance(latest, dict):
        status = str(latest.get("status") or "")
        current_day_key = now_eastern().date().isoformat()
        latest_day_key = _snapshot_day_key(latest)

        if status == "ready" and latest_day_key and latest_day_key != current_day_key:
            # Daily refresh: if the newest snapshot is from a prior ET day, generate a fresh one.
            latest = None
        elif status == "error" and latest_day_key and latest_day_key != current_day_key:
            # Retry automatically when the day changes.
            latest = None

        if isinstance(latest, dict) and _snapshot_request_key(latest) == request_key and status in {"pending", "ready", "error"}:
            data = None
            if status == "ready" and isinstance(latest.get("result"), dict):
                data = GenerateRecommendationsResponse(**latest["result"])

            snapshot_id = str(latest.get("snapshot_id") or latest.get("_id"))
            created_at = latest.get("created_at")
            updated_at = latest.get("updated_at")
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                except Exception:
                    created_at = None
            if isinstance(updated_at, str):
                try:
                    updated_at = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
                except Exception:
                    updated_at = None
            return RecommendationsSnapshotStatus(
                status=status,
                snapshot_id=snapshot_id,
                resume_id=resume_id,
                created_at=created_at if isinstance(created_at, datetime) else None,
                updated_at=updated_at if isinstance(updated_at, datetime) else None,
                data=data,
                error=str(latest.get("error") or "") or None,
            )

    snapshot_id, now = await _save_snapshot_pending(
        user_email=user_email,
        resume_id=resume_id,
        request_key=request_key,
        payload=payload,
    )
    background_tasks.add_task(_run_snapshot_job, snapshot_id=snapshot_id, user_email=user_email, payload=payload)
    return RecommendationsSnapshotStatus(
        status="pending",
        snapshot_id=snapshot_id,
        resume_id=resume_id,
        created_at=now,
        updated_at=now,
    )


@router.get("/latest", response_model=RecommendationsSnapshotStatus)
async def latest_recommendations(
    resume_id: str | None = None,
    user_email: str = Depends(get_current_user_email),
) -> RecommendationsSnapshotStatus:
    resolved = resume_id or await _get_latest_resume_id_for_user(user_email)
    if not resolved:
        return RecommendationsSnapshotStatus(status="missing", snapshot_id=None, resume_id=None)

    latest = await _load_latest_snapshot(user_email=user_email, resume_id=resolved)
    if not isinstance(latest, dict):
        return RecommendationsSnapshotStatus(status="missing", snapshot_id=None, resume_id=resolved)

    status = str(latest.get("status") or "missing")
    data = None
    if status == "ready" and isinstance(latest.get("result"), dict):
        data = GenerateRecommendationsResponse(**latest["result"])

    snapshot_id = str(latest.get("snapshot_id") or latest.get("_id"))
    created_at = latest.get("created_at")
    updated_at = latest.get("updated_at")
    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except Exception:
            created_at = None
    if isinstance(updated_at, str):
        try:
            updated_at = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
        except Exception:
            updated_at = None

    return RecommendationsSnapshotStatus(
        status=status,
        snapshot_id=snapshot_id,
        resume_id=resolved,
        created_at=created_at if isinstance(created_at, datetime) else None,
        updated_at=updated_at if isinstance(updated_at, datetime) else None,
        data=data,
        error=str(latest.get("error") or "") or None,
    )


@router.post("/tailor-resume/ensure", response_model=TailorResumeSnapshotStatus)
async def ensure_tailored_resume_for_job(
    payload: TailorResumeRequest,
    background_tasks: BackgroundTasks,
    user_email: str = Depends(get_current_user_email),
) -> TailorResumeSnapshotStatus:
    resolved_resume_id = payload.resume_id or await _get_latest_resume_id_for_user(user_email)
    if not resolved_resume_id:
        return TailorResumeSnapshotStatus(status="missing", snapshot_id=None, resume_id=None, job_uid=payload.job_uid)

    latest = await _load_latest_tailored_resume_snapshot(
        user_email=user_email,
        resume_id=resolved_resume_id,
        job_uid=payload.job_uid,
    )
    if isinstance(latest, dict):
        status = str(latest.get("status") or "")
        if status in {"pending", "ready"}:
            return _tailored_resume_snapshot_to_status(latest)

    snapshot_id, now = await _save_tailored_resume_snapshot_pending(
        user_email=user_email,
        resume_id=resolved_resume_id,
        job_uid=payload.job_uid,
    )
    background_tasks.add_task(
        _run_tailored_resume_snapshot_job,
        snapshot_id=snapshot_id,
        user_email=user_email,
        payload=TailorResumeRequest(job_uid=payload.job_uid, resume_id=resolved_resume_id),
    )
    return TailorResumeSnapshotStatus(
        status="pending",
        snapshot_id=snapshot_id,
        resume_id=resolved_resume_id,
        job_uid=payload.job_uid,
        created_at=now,
        updated_at=now,
    )


@router.get("/tailor-resume/latest", response_model=list[TailorResumeSnapshotStatus])
async def latest_tailored_resumes(
    resume_id: str | None = None,
    user_email: str = Depends(get_current_user_email),
) -> list[TailorResumeSnapshotStatus]:
    resolved_resume_id = resume_id or await _get_latest_resume_id_for_user(user_email)
    if not resolved_resume_id:
        return []

    rows = await _list_latest_tailored_resume_snapshots(user_email=user_email, resume_id=resolved_resume_id)
    return [_tailored_resume_snapshot_to_status(row) for row in rows]


@router.post("/tailor-resume", response_model=TailorResumeResponse)
async def tailor_resume_for_job(
    payload: TailorResumeRequest,
    user_email: str = Depends(get_current_user_email),
) -> TailorResumeResponse:
    return await _compute_tailored_resume(payload, user_email)
