from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.ai.factory import get_ai_provider
from app.api.deps import get_current_user_email
from app.db.collections import resume_feedback_collection, resumes_collection
from app.db.local_store import (
    create_resume_feedback as create_local_resume_feedback,
    get_resume_by_id_for_user as get_local_resume_by_id_for_user,
    get_resume_feedback_by_id_for_user as get_local_feedback_by_id_for_user,
    list_resumes_by_user as list_local_resumes_by_user,
    list_resume_feedback_by_user as list_local_feedback_by_user,
    update_resume_feedback_notes_by_id_for_user as update_local_feedback_notes_by_id_for_user,
)
from app.db.mongo import get_database
from app.schemas.feedback import ResumeFeedback


router = APIRouter(prefix="/resume-feedback")


_DEFAULT_SINGLE_SKILL_GAP = (
    "Add a concise Skills section aligned to your target internship role (languages, tools, frameworks, and key keywords)."
)


class GenerateFeedbackRequest(BaseModel):
    resume_id: str | None = Field(default=None, description="If omitted, uses the latest uploaded resume")


class GenerateFeedbackResponse(BaseModel):
    feedback_id: str
    feedback: ResumeFeedback


class FeedbackListItem(BaseModel):
    feedback_id: str
    resume_id: str | None = None
    summary: str | None = None
    created_at: datetime


class UpdateNotesRequest(BaseModel):
    saved_notes: str | None = Field(default=None, max_length=10000)


def _parse_datetime(value: str | datetime | None) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return datetime.now(timezone.utc)


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


@router.post("/generate", response_model=GenerateFeedbackResponse)
async def generate_feedback(
    payload: GenerateFeedbackRequest,
    user_email: str = Depends(get_current_user_email),
) -> GenerateFeedbackResponse:
    resume_id = payload.resume_id or await _get_latest_resume_id_for_user(user_email)
    if not resume_id:
        raise HTTPException(status_code=404, detail="No resume found for user")

    resume_doc = await _get_resume_doc_for_user(resume_id, user_email)
    if resume_doc is None:
        raise HTTPException(status_code=404, detail="Resume not found")

    extracted_text = resume_doc.get("extracted_text")
    if not extracted_text or not isinstance(extracted_text, str) or not extracted_text.strip():
        raise HTTPException(
            status_code=409,
            detail="Resume has no extracted text yet. Re-extract the resume and try again.",
        )

    provider = get_ai_provider()
    ai_feedback = await provider.resume_feedback(extracted_text)

    created_at = datetime.now(timezone.utc)
    feedback = ResumeFeedback(
        user_email=user_email,
        resume_id=str(resume_id),
        summary=ai_feedback.summary,
        strong_points=list(ai_feedback.strong_points),
        areas_to_improve=list(ai_feedback.areas_to_improve),
        suggested_edits=list(ai_feedback.suggested_edits),
        skill_gaps=(list(ai_feedback.skill_gaps)[:1] or [_DEFAULT_SINGLE_SKILL_GAP]),
        created_at=created_at,
        saved_notes=None,
    )

    db = get_database()
    if db is None:
        feedback_id = create_local_resume_feedback(feedback.model_dump(mode="json"))
        return GenerateFeedbackResponse(feedback_id=feedback_id, feedback=feedback)

    coll = resume_feedback_collection(db)
    result = await coll.insert_one(feedback.model_dump())
    return GenerateFeedbackResponse(feedback_id=str(result.inserted_id), feedback=feedback)


@router.get("/me", response_model=list[FeedbackListItem])
async def list_my_feedback(
    limit: int = 20,
    user_email: str = Depends(get_current_user_email),
) -> list[FeedbackListItem]:
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 100")

    db = get_database()
    items: list[FeedbackListItem] = []

    if db is None:
        rows = list_local_feedback_by_user(user_email=user_email, limit=limit)
        for doc in rows:
            items.append(
                FeedbackListItem(
                    feedback_id=str(doc.get("feedback_id")),
                    resume_id=doc.get("resume_id"),
                    summary=doc.get("summary"),
                    created_at=_parse_datetime(doc.get("created_at")),
                )
            )
        return items

    coll = resume_feedback_collection(db)
    cursor = coll.find({"user_email": user_email}).sort("created_at", -1).limit(limit)
    async for doc in cursor:
        items.append(
            FeedbackListItem(
                feedback_id=str(doc.get("_id")),
                resume_id=doc.get("resume_id"),
                summary=doc.get("summary"),
                created_at=doc.get("created_at"),
            )
        )
    return items


@router.get("/{feedback_id}", response_model=ResumeFeedback)
async def get_feedback(
    feedback_id: str,
    user_email: str = Depends(get_current_user_email),
) -> ResumeFeedback:
    db = get_database()

    if db is None:
        doc = get_local_feedback_by_id_for_user(feedback_id=feedback_id, user_email=user_email)
        if doc is None:
            raise HTTPException(status_code=404, detail="Feedback not found")
        doc.pop("feedback_id", None)
        return ResumeFeedback(**doc)

    coll = resume_feedback_collection(db)
    try:
        oid = ObjectId(feedback_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid feedback_id")

    doc = await coll.find_one({"_id": oid, "user_email": user_email})
    if doc is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    doc.pop("_id", None)
    return ResumeFeedback(**doc)


@router.put("/{feedback_id}/notes", response_model=ResumeFeedback)
async def update_feedback_notes(
    feedback_id: str,
    payload: UpdateNotesRequest,
    user_email: str = Depends(get_current_user_email),
) -> ResumeFeedback:
    db = get_database()

    if db is None:
        updated = update_local_feedback_notes_by_id_for_user(
            feedback_id=feedback_id, user_email=user_email, saved_notes=payload.saved_notes
        )
        if updated is None:
            raise HTTPException(status_code=404, detail="Feedback not found")
        updated.pop("feedback_id", None)
        return ResumeFeedback(**updated)

    coll = resume_feedback_collection(db)
    try:
        oid = ObjectId(feedback_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid feedback_id")

    note_text = (payload.saved_notes or "").strip()
    if note_text:
        await coll.update_one(
            {"_id": oid, "user_email": user_email},
            {
                "$set": {"saved_notes": note_text},
                "$push": {"notes_history": {"created_at": datetime.now(timezone.utc), "text": note_text}},
            },
        )
    else:
        await coll.update_one(
            {"_id": oid, "user_email": user_email},
            {"$set": {"saved_notes": None}},
        )
    doc = await coll.find_one({"_id": oid, "user_email": user_email})
    if doc is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    doc.pop("_id", None)
    return ResumeFeedback(**doc)
