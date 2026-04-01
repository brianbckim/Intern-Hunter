from __future__ import annotations

from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user_email
from app.db.collections import applications_collection
from app.db.local_store import delete_application_by_id_for_user as delete_local_application
from app.db.local_store import list_applications_by_user as list_local_applications
from app.db.local_store import upsert_job_application_for_user as upsert_local_application
from app.db.mongo import get_database
from app.schemas.application import ApplicationStatus
from app.utils.time import now_eastern


router = APIRouter(prefix="/applications")


class ApplicationCreateBody(BaseModel):
    job_source: str = Field(min_length=1, max_length=50)
    job_external_id: str = Field(min_length=1, max_length=200)
    status: ApplicationStatus = ApplicationStatus.applied
    job_title: str | None = Field(default=None, max_length=500)
    job_company: str | None = Field(default=None, max_length=500)
    job_location: str | None = Field(default=None, max_length=500)
    job_url: str | None = Field(default=None, max_length=4000)


class ApplicationOut(BaseModel):
    application_id: str
    job_source: str
    job_external_id: str
    status: str
    job_title: str | None = None
    job_company: str | None = None
    job_location: str | None = None
    job_url: str | None = None
    created_at: str
    updated_at: str


def _doc_to_out(doc: dict[str, Any]) -> ApplicationOut:
    raw_id = doc.get("_id") or doc.get("application_id")
    if raw_id is None:
        application_id = ""
    elif hasattr(raw_id, "__str__") and not isinstance(raw_id, str):
        application_id = str(raw_id)
    else:
        application_id = str(raw_id)

    def iso_maybe(value: Any) -> str:
        if value is None:
            return ""
        if hasattr(value, "isoformat"):
            return value.isoformat()
        return str(value)

    return ApplicationOut(
        application_id=application_id,
        job_source=str(doc.get("job_source", "")),
        job_external_id=str(doc.get("job_external_id", "")),
        status=str(doc.get("status", "applied")),
        job_title=doc.get("job_title"),
        job_company=doc.get("job_company"),
        job_location=doc.get("job_location"),
        job_url=doc.get("job_url"),
        created_at=iso_maybe(doc.get("created_at")) or iso_maybe(doc.get("updated_at")),
        updated_at=iso_maybe(doc.get("updated_at")) or iso_maybe(doc.get("created_at")),
    )


@router.get("/me", response_model=list[ApplicationOut])
async def list_my_applications(
    current_user_email: str = Depends(get_current_user_email),
) -> list[ApplicationOut]:
    db = get_database()
    if db is None:
        rows = list_local_applications(current_user_email)
        return [_doc_to_out(row) for row in rows]

    col = applications_collection(db)
    cursor = (
        col.find({"user_email": current_user_email})
        .sort([("updated_at", -1), ("created_at", -1)])
        .limit(500)
    )
    result: list[ApplicationOut] = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        result.append(_doc_to_out(doc))
    return result


@router.post("/me", response_model=ApplicationOut, status_code=status.HTTP_200_OK)
async def upsert_my_application(
    body: ApplicationCreateBody,
    current_user_email: str = Depends(get_current_user_email),
) -> ApplicationOut:
    db = get_database()
    now = now_eastern()

    if db is None:
        try:
            row = upsert_local_application(
                current_user_email,
                {
                    "job_source": body.job_source,
                    "job_external_id": body.job_external_id,
                    "status": body.status.value,
                    "job_title": body.job_title,
                    "job_company": body.job_company,
                    "job_location": body.job_location,
                    "job_url": body.job_url,
                },
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return _doc_to_out(row)

    col = applications_collection(db)
    filt: dict[str, Any] = {
        "user_email": current_user_email,
        "job_source": body.job_source.strip(),
        "job_external_id": body.job_external_id.strip(),
    }

    await col.update_one(
        filt,
        {
            "$set": {
                "status": body.status.value,
                "job_title": body.job_title,
                "job_company": body.job_company,
                "job_location": body.job_location,
                "job_url": body.job_url,
                "updated_at": now,
            },
            "$setOnInsert": {
                "user_email": current_user_email,
                "job_source": body.job_source.strip(),
                "job_external_id": body.job_external_id.strip(),
                "created_at": now,
            },
        },
        upsert=True,
    )
    doc = await col.find_one(filt)
    if doc is None:
        raise HTTPException(status_code=500, detail="Failed to save application")
    doc["_id"] = str(doc["_id"])
    return _doc_to_out(doc)


@router.delete("/me/{application_id}", status_code=status.HTTP_200_OK)
async def delete_my_application(
    application_id: str,
    current_user_email: str = Depends(get_current_user_email),
) -> dict[str, str]:
    db = get_database()
    raw_id = application_id.strip()
    if not raw_id:
        raise HTTPException(status_code=400, detail="Invalid application id")

    if db is None:
        ok = delete_local_application(raw_id, current_user_email)
        if not ok:
            raise HTTPException(status_code=404, detail="Application not found")
        return {"detail": "deleted"}

    try:
        oid = ObjectId(raw_id)
    except InvalidId as exc:
        raise HTTPException(status_code=400, detail="Invalid application id") from exc

    col = applications_collection(db)
    result = await col.delete_one({"_id": oid, "user_email": current_user_email})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"detail": "deleted"}
