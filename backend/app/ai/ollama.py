from __future__ import annotations

from app.ai.base import AIProvider, CareerRecommendations, ResumeFeedback
from app.ai.ollama_recommendations import OllamaRecommendationsProvider
from app.ai.ollama_resume_feedback import OllamaResumeFeedbackProvider


class OllamaAIProvider:
    def __init__(self) -> None:
        self._resume = OllamaResumeFeedbackProvider()
        self._recs = OllamaRecommendationsProvider()

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


def provider() -> AIProvider:
    return OllamaAIProvider()
