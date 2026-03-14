from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True)
class ResumeFeedback:
    summary: str
    strong_points: tuple[str, ...] = ()
    areas_to_improve: tuple[str, ...] = ()
    suggested_edits: tuple[str, ...] = ()
    skill_gaps: tuple[str, ...] = ()


@dataclass(frozen=True)
class CareerRecommendations:
    career_summary: str
    recommended_roles: tuple[str, ...] = ()
    recommended_skills: tuple[str, ...] = ()
    ranked_job_uids: tuple[str, ...] = ()
    job_reasons: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class TailoredResumeDraft:
    summary: str
    tailored_resume: str
    targeted_edits: tuple[str, ...] = ()
    keywords_to_highlight: tuple[str, ...] = ()


class AIProvider(Protocol):
    async def resume_feedback(self, resume_text: str) -> ResumeFeedback:  # pragma: no cover
        ...

    async def career_recommendations(
        self,
        *,
        user_profile: str,
        resume_text: str | None,
        candidate_jobs: list[dict[str, Any]],
        limit: int,
    ) -> CareerRecommendations:  # pragma: no cover
        ...

    async def tailor_resume_for_job(
        self,
        *,
        user_profile: str,
        resume_text: str,
        job_title: str,
        job_company: str | None,
        job_description: str,
    ) -> TailoredResumeDraft:  # pragma: no cover
        ...
