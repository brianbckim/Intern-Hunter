from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from app.jobs.listing_loader import NormalizedJob
from app.schemas.profile import UserProfile


_WORD_RE = re.compile(r"[a-z0-9][a-z0-9+.#-]{0,48}")
_NON_ALNUM_RE = re.compile(r"[^a-z0-9+#.]+")
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

ALIASES = {
    "ml": "machine learning",
    "machine-learning": "machine learning",
    "dl": "deep learning",
    "deep-learning": "deep learning",
    "nlp": "natural language processing",
    "nlu": "natural language understanding",
    "llm": "large language model",
    "llms": "large language models",
    "gen ai": "generative ai",
    "genai": "generative ai",
    "ai/ml": "machine learning",
    "cv": "computer vision",
    "rl": "reinforcement learning",
    "ir": "information retrieval",
    "qa": "quality assurance",
    "qa engineer": "quality assurance engineer",
    "sdet": "software development engineer in test",
    "pm": "product manager",
    "tpm": "technical product manager",
    "pdm": "product manager",
    "ba": "business analyst",
    "bi": "business intelligence",
    "de": "data engineer",
    "ds": "data scientist",
    "mle": "machine learning engineer",
    "ml engineer": "machine learning engineer",
    "ai engineer": "artificial intelligence engineer",
    "mlops": "ml ops engineer",
    "ml ops": "ml ops engineer",
    "sre": "site reliability engineer",
    "dev ops": "devops engineer",
    "devops": "devops engineer",
    "secops": "security engineer",
    "appsec": "application security engineer",
    "infosec": "security engineer",
    "swe": "software engineer",
    "sde": "software engineer",
    "software eng": "software engineer",
    "backend": "backend engineer",
    "backend developer": "backend engineer",
    "back end": "backend engineer",
    "back end developer": "backend engineer",
    "back end engineer": "backend engineer",
    "frontend": "frontend engineer",
    "front end": "frontend engineer",
    "frontend developer": "frontend engineer",
    "front end developer": "frontend engineer",
    "front end engineer": "frontend engineer",
    "fullstack": "full stack developer",
    "full-stack": "full stack developer",
    "full stack engineer": "full stack developer",
    "full-stack engineer": "full stack developer",
    "full-stack developer": "full stack developer",
    "web dev": "web developer",
    "mobile dev": "mobile developer",
    "ios": "ios development",
    "android": "android development",
    "js": "javascript",
    "ts": "typescript",
    "node": "node.js",
    "nodejs": "node.js",
    "expressjs": "express",
    "reactjs": "react",
    "nextjs": "next.js",
    "vuejs": "vue",
    "nuxtjs": "nuxt.js",
    "angularjs": "angular",
    "html5": "html",
    "css3": "css",
    "postgres": "postgresql",
    "mongo": "mongodb",
    "k8s": "kubernetes",
    "kubernets": "kubernetes",
    "tf": "tensorflow",
    "torch": "pytorch",
    "sklearn": "scikit-learn",
    "scikit learn": "scikit-learn",
    "huggingface": "huggingface transformers",
    "hf transformers": "huggingface transformers",
    "lang chain": "langchain",
    "llama index": "llamaindex",
    "rest": "rest api",
    "restful api": "rest api",
    "apis": "api",
    "ci/cd": "ci cd engineer",
    "ci-cd": "ci cd engineer",
    "a/b testing": "ab testing",
    "a b testing": "ab testing",
    "observability stack": "observability",
    "otel": "open telemetry",
    "elasticsearch": "elastic search",
    "recsys": "recommendation systems",
    "recommender systems": "recommendation systems",
    "time-series": "time series forecasting",
}


@dataclass(frozen=True)
class ScoredJob:
    job: NormalizedJob
    score: float
    matched_keywords: tuple[str, ...] = ()


def _tokens(text: str) -> set[str]:
    words = {w.lower() for w in _WORD_RE.findall(text.lower())}
    return {w for w in words if len(w) >= 2 and w not in _STOPWORDS}


def _normalize_phrase(text: str) -> str:
    lowered = text.strip().lower()
    lowered = lowered.replace("&", " and ")
    lowered = lowered.replace("/", " ")
    lowered = lowered.replace("_", " ")
    lowered = lowered.replace("-", " ")
    lowered = _NON_ALNUM_RE.sub(" ", lowered)
    lowered = re.sub(r"\s+", " ", lowered).strip()
    return ALIASES.get(lowered, lowered)


def _replace_aliases(text: str) -> str:
    normalized = f" {_normalize_phrase(text)} "
    for alias, canonical in sorted(ALIASES.items(), key=lambda item: len(item[0]), reverse=True):
        alias_norm = _normalize_phrase(alias)
        canonical_norm = _normalize_phrase(canonical)
        if not alias_norm or alias_norm == canonical_norm:
            continue
        normalized = normalized.replace(f" {alias_norm} ", f" {canonical_norm} ")
    return re.sub(r"\s+", " ", normalized).strip()


def _resource_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "resources" / "recommendations"


@lru_cache(maxsize=1)
def _load_dictionary_terms() -> tuple[frozenset[str], frozenset[str]]:
    def load_file(name: str) -> frozenset[str]:
        path = _resource_dir() / name
        if not path.exists():
            return frozenset()

        values: set[str] = set()
        with path.open("r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                normalized = _normalize_phrase(line)
                if normalized:
                    values.add(normalized)
        return frozenset(values)

    return load_file("skills.txt"), load_file("roles.txt")


def _extract_dictionary_matches(text: str, dictionary: frozenset[str]) -> set[str]:
    if not text or not dictionary:
        return set()

    normalized_text = f" {_replace_aliases(text)} "
    text_tokens = _tokens(normalized_text)
    matches: set[str] = set()
    for term in dictionary:
        if not term:
            continue
        if " " in term or "+" in term or "." in term or "#" in term:
            if f" {term} " in normalized_text:
                matches.add(term)
        elif term in text_tokens:
            matches.add(term)
    return matches


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


def _profile_text(profile: UserProfile, resume_text: str | None = None) -> str:
    parts: list[str] = []
    if profile.major_or_program:
        parts.append(profile.major_or_program)
    if profile.career_interests:
        parts.append(profile.career_interests)
    for skill in profile.skills or []:
        if skill:
            parts.append(skill)
    if resume_text:
        parts.append(resume_text[:20000])
    return "\n".join(parts)


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
    resume_text: str | None = None,
    limit: int = 50,
) -> list[ScoredJob]:
    """Dictionary-based ranking to produce a short candidate list for AI re-ranking."""

    if limit < 1:
        return []

    skills_dict, roles_dict = _load_dictionary_terms()
    user_text = _profile_text(profile, resume_text)
    user_skills = _extract_dictionary_matches(user_text, skills_dict)
    user_roles = _extract_dictionary_matches(user_text, roles_dict)
    keywords = _profile_keywords(profile)

    scored: list[ScoredJob] = []
    for job in jobs:
        title = job.title or ""
        category = job.category or ""
        company = job.company or ""
        location = job.location or ""
        sponsorship = job.sponsorship or ""
        job_text = "\n".join([title, category, company, location, sponsorship])

        job_skills = _extract_dictionary_matches(job_text, skills_dict)
        job_roles = _extract_dictionary_matches(job_text, roles_dict)

        matched_skills = sorted(user_skills.intersection(job_skills))
        matched_roles = sorted(user_roles.intersection(job_roles))

        title_tokens = _tokens(title)
        category_tokens = _tokens(category)

        title_hits = sorted(title_tokens.intersection(keywords))
        category_hits = sorted(category_tokens.intersection(keywords))

        score = 0.0
        score += 4.0 * float(len(matched_roles))
        score += 2.5 * float(len(matched_skills))
        score += 3.0 * float(len(title_hits))
        score += 2.0 * float(len(category_hits))
        score += _recency_bonus(job.date_posted)

        if matched_roles:
            score += 1.0
        if len(matched_skills) >= 3:
            score += 0.75

        if "co-op" in title.lower() or "coop" in title.lower():
            score += 0.15
        if "intern" in title.lower():
            score += 0.1

        matched = tuple((matched_roles + matched_skills + title_hits + category_hits)[:8])
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
