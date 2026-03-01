from __future__ import annotations

from app.ai.base import AIProvider, CareerRecommendations, ResumeFeedback


class MockAIProvider:
    async def resume_feedback(self, resume_text: str) -> ResumeFeedback:
        length = len(resume_text.strip())
        if length == 0:
            return ResumeFeedback(
                summary="No resume text provided.",
                skill_gaps=(
                    "Add a concise Skills section aligned to your target internship role (languages, tools, frameworks, and key keywords).",
                ),
            )
        return ResumeFeedback(
            summary=f"Mock feedback generated (chars={length}).",
            skill_gaps=(
                "Add a concise Skills section aligned to your target internship role (languages, tools, frameworks, and key keywords).",
            ),
        )

    async def career_recommendations(
        self,
        *,
        user_profile: str,
        resume_text: str | None,
        candidate_jobs: list[dict[str, object]],
        limit: int,
    ) -> CareerRecommendations:
        uids: list[str] = []
        for item in candidate_jobs:
            uid = item.get("uid")
            if isinstance(uid, str) and uid.strip():
                uids.append(uid.strip())
            if len(uids) >= max(0, int(limit)):
                break

        reasons = {uid: "Recommended based on your profile keywords and recent listings." for uid in uids}
        return CareerRecommendations(
            career_summary=(user_profile or "Mock career summary."),
            recommended_roles=(),
            recommended_skills=(),
            ranked_job_uids=tuple(uids),
            job_reasons=reasons,
        )


def provider() -> AIProvider:
    return MockAIProvider()
