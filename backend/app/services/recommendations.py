from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone

from app.jobs.listing_loader import NormalizedJob
from app.schemas.profile import UserProfile


_WORD_RE = re.compile(r"[a-z0-9][a-z0-9+.#-]{0,48}")
_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "but",
    "by",
    "for",
    "from",
    "in",
    "intern",
    "internship",
    "is",
    "it",
    "of",
    "on",
    "or",
    "role",
    "software",
    "the",
    "to",
    "with",
}


@dataclass(frozen=True)
class ScoredJob:
    job: NormalizedJob
    score: float
    matched_keywords: tuple[str, ...] = ()


def _tokens(text: str) -> set[str]:
    words = {w.lower() for w in _WORD_RE.findall(text.lower())}
    return {w for w in words if len(w) >= 2 and w not in _STOPWORDS}


def _profile_keywords(profile: UserProfile) -> set[str]:
    parts: list[str] = []
    if profile.major_or_program:
        parts.append(profile.major_or_program)
    if profile.career_interests:
        parts.append(profile.career_interests)
    for s in profile.skills or []:
        if s:
            parts.append(s)
    return _tokens(" ".join(parts))


def _recency_bonus(date_posted: int | None) -> float:
    if not date_posted:
        return 0.0
    try:
        now = datetime.now(timezone.utc).timestamp()
        days = max(0.0, (now - float(date_posted)) / 86400.0)
        # Smoothly decays to ~0 around 45 days.
        return max(0.0, 1.0 - (days / 45.0))
    except Exception:
        return 0.0


def score_jobs_for_user(
    jobs: list[NormalizedJob],
    *,
    profile: UserProfile,
    limit: int = 50,
) -> list[ScoredJob]:
    """Heuristic ranking to produce a short candidate list for AI re-ranking."""

    if limit < 1:
        return []

    keywords = _profile_keywords(profile)

    scored: list[ScoredJob] = []
    for job in jobs:
        title = job.title or ""
        category = job.category or ""

        title_tokens = _tokens(title)
        category_tokens = _tokens(category)

        title_hits = sorted(title_tokens.intersection(keywords))
        category_hits = sorted(category_tokens.intersection(keywords))

        score = 0.0
        score += 3.0 * float(len(title_hits))
        score += 2.0 * float(len(category_hits))
        score += _recency_bonus(job.date_posted)

        if "co-op" in title.lower() or "coop" in title.lower():
            score += 0.15
        if "intern" in title.lower():
            score += 0.1

        matched = tuple((title_hits + category_hits)[:8])
        scored.append(ScoredJob(job=job, score=score, matched_keywords=matched))

    scored.sort(key=lambda x: x.score, reverse=True)
    return scored[:limit]


def profile_summary(profile: UserProfile) -> str:
    skills = ", ".join(profile.skills or [])
    parts: list[str] = []
    if profile.major_or_program:
        parts.append(f"Major/Program: {profile.major_or_program}")
    if profile.career_interests:
        parts.append(f"Interests: {profile.career_interests}")
    if skills:
        parts.append(f"Skills: {skills}")
    if profile.graduation_year:
        parts.append(f"Graduation year: {profile.graduation_year}")
    return " | ".join(parts) or "No profile info provided."
