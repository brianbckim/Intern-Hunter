from __future__ import annotations

import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.api.deps import get_current_user_email
from app.db.collections import resumes_collection
from app.db.deps import require_db
from app.schemas.resume import ResumeDocument


router = APIRouter(prefix="/resumes")


ALLOWED_CONTENT_TYPES: set[str] = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
ALLOWED_EXTENSIONS: set[str] = {".pdf", ".doc", ".docx"}


class ResumeUploadResponse(BaseModel):
    resume_id: str
    resume: ResumeDocument


class ResumeListItem(BaseModel):
    resume_id: str
    original_filename: str
    content_type: str | None = None
    uploaded_at: datetime
    analyzed_at: datetime | None = None


def _safe_segment(value: str) -> str:
    value = value.strip().lower()
    value = value.replace("@", "_at_")
    value = re.sub(r"[^a-z0-9._-]+", "_", value)
    return value[:120] or "user"


def _backend_root() -> Path:
    # .../backend/app/api/routes/resumes.py -> parents[3] == .../backend
    return Path(__file__).resolve().parents[3]


def _uploads_root() -> Path:
    return _backend_root() / "uploads"


def _validate_upload(file: UploadFile) -> None:
    filename = (file.filename or "").strip()
    if not filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF/DOC/DOCX files are allowed")

    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported content type: {file.content_type}")


@router.post("/upload", response_model=ResumeUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    file: UploadFile = File(...),
    user_email: str = Depends(get_current_user_email),
) -> ResumeUploadResponse:
    _validate_upload(file)

    db = require_db()
    resumes = resumes_collection(db)

    user_segment = _safe_segment(user_email)
    original_filename = (file.filename or "resume").strip()
    ext = Path(original_filename).suffix.lower()
    stored_filename = f"{uuid4().hex}{ext}"
    stored_path = _uploads_root() / user_segment / stored_filename
    stored_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with stored_path.open("wb") as out:
            shutil.copyfileobj(file.file, out)
    finally:
        await file.close()

    resume = ResumeDocument(
        user_email=user_email,
        original_filename=original_filename,
        content_type=file.content_type,
        storage_ref=str(stored_path.relative_to(_backend_root())),
        extracted_text=None,
        uploaded_at=datetime.now(timezone.utc),
        analyzed_at=None,
    )
    doc: dict[str, Any] = resume.model_dump()
    result = await resumes.insert_one(doc)
    resume_id = str(result.inserted_id)

    return ResumeUploadResponse(resume_id=resume_id, resume=resume)


@router.get("/me", response_model=list[ResumeListItem])
async def list_my_resumes(
    limit: int = 20,
    user_email: str = Depends(get_current_user_email),
) -> list[ResumeListItem]:
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 100")

    db = require_db()
    resumes = resumes_collection(db)

    cursor = resumes.find({"user_email": user_email}).sort("uploaded_at", -1).limit(limit)
    items: list[ResumeListItem] = []
    async for doc in cursor:
        items.append(
            ResumeListItem(
                resume_id=str(doc.get("_id")),
                original_filename=str(doc.get("original_filename", "")),
                content_type=doc.get("content_type"),
                uploaded_at=doc.get("uploaded_at"),
                analyzed_at=doc.get("analyzed_at"),
            )
        )
    return items


@router.get("/{resume_id}")
async def get_resume(
    resume_id: str,
    user_email: str = Depends(get_current_user_email),
) -> dict[str, Any]:
    db = require_db()
    resumes = resumes_collection(db)

    try:
        oid = ObjectId(resume_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid resume_id")

    doc = await resumes.find_one({"_id": oid, "user_email": user_email})
    if doc is None:
        raise HTTPException(status_code=404, detail="Resume not found")

    doc["resume_id"] = str(doc.pop("_id"))
    return doc


@router.get("/{resume_id}/file")
async def download_resume_file(
    resume_id: str,
    user_email: str = Depends(get_current_user_email),
) -> FileResponse:
    db = require_db()
    resumes = resumes_collection(db)

    try:
        oid = ObjectId(resume_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid resume_id")

    doc = await resumes.find_one({"_id": oid, "user_email": user_email})
    if doc is None:
        raise HTTPException(status_code=404, detail="Resume not found")

    storage_ref = doc.get("storage_ref")
    if not storage_ref:
        raise HTTPException(status_code=404, detail="Resume file not available")

    file_path = (_backend_root() / str(storage_ref)).resolve()
    uploads_root = _uploads_root().resolve()
    if uploads_root not in file_path.parents:
        raise HTTPException(status_code=500, detail="Invalid storage reference")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Resume file missing on server")

    return FileResponse(
        path=str(file_path),
        media_type=doc.get("content_type") or "application/octet-stream",
        filename=doc.get("original_filename") or "resume",
    )
