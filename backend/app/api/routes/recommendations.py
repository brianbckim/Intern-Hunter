from __future__ import annotations

from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.ai.factory import get_ai_provider
from app.api.deps import get_current_user_email
from app.db.collections import profiles_collection, resumes_collection
from app.db.local_store import get_profile as get_local_profile
from app.db.local_store import list_resumes_by_user as list_local_resumes_by_user
from app.db.local_store import get_resume_by_id_for_user as get_local_resume_by_id_for_user
from app.db.mongo import get_database
from app.jobs.listing_loader import list_visible_jobs
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
    if payload.candidate_pool < payload.limit:
        raise HTTPException(status_code=400, detail="candidate_pool must be >= limit")

    jobs = list_visible_jobs(limit=5000)
    if not jobs:
        return GenerateRecommendationsResponse(ai_used=False, jobs=[])

    profile = await _get_profile_for_user(user_email)
    scored = score_jobs_for_user(jobs, profile=profile, limit=payload.candidate_pool)
    candidates = scored

    resume_text: str | None = None
    if payload.resume_id is not None or payload.use_ai:
        resume_id = payload.resume_id or await _get_latest_resume_id_for_user(user_email)
        if resume_id:
            doc = await _get_resume_doc_for_user(resume_id, user_email)
            if isinstance(doc, dict):
                extracted = doc.get("extracted_text")
                if isinstance(extracted, str) and extracted.strip():
                    resume_text = extracted.strip()[:12000]

    response = GenerateRecommendationsResponse(ai_used=False)

    # Optional AI-based reranking and summary.
    ranked_uids: list[str] = []
    reasons: dict[str, str] = {}
    if payload.use_ai:
        try:
            provider = get_ai_provider()
            ai = await provider.career_recommendations(
                user_profile=profile_summary(profile),
                resume_text=resume_text,
                candidate_jobs=[
                    {
                        "uid": c.job.uid,
                        "title": c.job.title or "",
                        "company": c.job.company or "",
                        "location": c.job.location or "",
                        "category": c.job.category or "",
                        "url": c.job.url or "",
                        "sponsorship": c.job.sponsorship or "",
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
