from __future__ import annotations

from app.ai.base import AIProvider, CareerRecommendations, ResumeFeedback, TailoredResumeDraft
from app.ai.ollama_recommendations import OllamaRecommendationsProvider
from app.ai.ollama_resume_feedback import OllamaResumeFeedbackProvider
from app.ai.ollama_resume_tailoring import OllamaResumeTailoringProvider


class OllamaAIProvider:
    def __init__(self) -> None:
        self._resume = OllamaResumeFeedbackProvider()
        self._recs = OllamaRecommendationsProvider()
        self._tailor = OllamaResumeTailoringProvider()

    async def resume_feedback(self, resume_text: str) -> ResumeFeedback:
        return await self._resume.resume_feedback(resume_text)

    async def career_recommendations(
        self,
        *,
        user_profile: str,
        resume_text: str | None,
        candidate_jobs: list[dict[str, object]],
        limit: int,
    ) -> CareerRecommendations:
        return await self._recs.career_recommendations(
            user_profile=user_profile,
            resume_text=resume_text,
            candidate_jobs=candidate_jobs,
            limit=limit,
        )

    async def tailor_resume_for_job(
        self,
        *,
        user_profile: str,
        resume_text: str,
        job_title: str,
        job_company: str | None,
        job_description: str,
    ) -> TailoredResumeDraft:
        return await self._tailor.tailor_resume_for_job(
            user_profile=user_profile,
            resume_text=resume_text,
            job_title=job_title,
            job_company=job_company,
            job_description=job_description,
        )


def provider() -> AIProvider:
    return OllamaAIProvider()
