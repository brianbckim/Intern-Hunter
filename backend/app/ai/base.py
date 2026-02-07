from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ResumeFeedback:
    summary: str


class AIProvider(Protocol):
    async def resume_feedback(self, resume_text: str) -> ResumeFeedback:  # pragma: no cover
        ...
