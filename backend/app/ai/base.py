from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ResumeFeedback:
    summary: str
    strong_points: tuple[str, ...] = ()
    areas_to_improve: tuple[str, ...] = ()
    suggested_edits: tuple[str, ...] = ()
    skill_gaps: tuple[str, ...] = ()


class AIProvider(Protocol):
    async def resume_feedback(self, resume_text: str) -> ResumeFeedback:  # pragma: no cover
        ...
