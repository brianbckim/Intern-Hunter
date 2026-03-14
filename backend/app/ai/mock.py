from __future__ import annotations

from app.ai.base import AIProvider, CareerRecommendations, ResumeFeedback, TailoredResumeDraft


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

    async def tailor_resume_for_job(
        self,
        *,
        user_profile: str,
        resume_text: str,
        job_title: str,
        job_company: str | None,
        job_description: str,
    ) -> TailoredResumeDraft:
        company = job_company or "the target company"
        return TailoredResumeDraft(
            summary=f"Mock tailored resume draft for {job_title} at {company}.",
            tailored_resume=(resume_text or "").strip()[:3000] or "No resume text provided.",
            targeted_edits=(
                f"Highlight experience most relevant to {job_title}.",
                "Move the strongest matching project or internship higher in the resume.",
                "Add measurable impact where possible to strengthen alignment.",
            ),
            keywords_to_highlight=("problem solving", "technical skills", "results"),
        )


def provider() -> AIProvider:
    return MockAIProvider()
