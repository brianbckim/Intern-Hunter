from __future__ import annotations

from app.ai.base import AIProvider, ResumeFeedback


class MockAIProvider:
    async def resume_feedback(self, resume_text: str) -> ResumeFeedback:
        length = len(resume_text.strip())
        if length == 0:
            return ResumeFeedback(summary="No resume text provided.")
        return ResumeFeedback(summary=f"Mock feedback generated (chars={length}).")


def provider() -> AIProvider:
    return MockAIProvider()
