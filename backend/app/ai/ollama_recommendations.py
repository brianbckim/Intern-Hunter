from __future__ import annotations

import json
import re

import httpx

from app.ai.base import CareerRecommendations
from app.core.config import settings


_JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


def _parse_json_object(text: str) -> dict:
    cleaned = text.strip()
    cleaned = cleaned.removeprefix("```json").removeprefix("```")
    cleaned = cleaned.removesuffix("```")
    cleaned = cleaned.strip()

    try:
        value = json.loads(cleaned)
        if isinstance(value, dict):
            return value
    except Exception:
        pass

    match = _JSON_BLOCK_RE.search(cleaned)
    if match:
        try:
            value = json.loads(match.group(0))
            if isinstance(value, dict):
                return value
        except Exception:
            pass

    return {}


def _as_str_list(value: object, *, limit: int) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()

    out: list[str] = []
    for item in value:
        if isinstance(item, str):
            s = item.strip()
            if s:
                out.append(s)
        if len(out) >= limit:
            break
    return tuple(out)


def _as_str_map(value: object, *, limit: int) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    out: dict[str, str] = {}
    for k, v in value.items():
        if len(out) >= limit:
            break
        if not isinstance(k, str):
            continue
        if not isinstance(v, str):
            continue
        key = k.strip()
        val = v.strip()
        if key and val:
            out[key] = val
    return out

class OllamaRecommendationsProvider:
    async def _chat_json(self, *, system: str, user: str) -> dict:
        payload = {
            "model": settings.OLLAMA_MODEL,
            "stream": False,
            "format": "json",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "options": {
                "temperature": 0.2,
            },
        }

        timeout = httpx.Timeout(settings.OLLAMA_REQUEST_TIMEOUT_SECONDS)
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat", json=payload)
            res.raise_for_status()
            data = res.json()

        content = ""
        if isinstance(data, dict):
            message = data.get("message")
            if isinstance(message, dict):
                content = str(message.get("content") or "")
        return _parse_json_object(content)

    async def career_recommendations(
        self,
        *,
        user_profile: str,
        resume_text: str | None,
        candidate_jobs: list[dict[str, object]],
        limit: int,
    ) -> CareerRecommendations:
        limit = max(1, min(int(limit), 50))

        # Keep payload compact: only include essential job fields.
        # (We intentionally do not include long fields like `url` in the LLM prompt.)
        compact_jobs: list[dict[str, str]] = []
        for item in candidate_jobs[:200]:
            uid = item.get("uid")
            if not isinstance(uid, str) or not uid.strip():
                continue
            compact_jobs.append(
                {
                    "uid": uid.strip(),
                    "title": str(item.get("title") or "")[:200],
                    "company": str(item.get("company") or "")[:120],
                    "location": str(item.get("location") or "")[:160],
                    "category": str(item.get("category") or "")[:80],
                    "sponsorship": str(item.get("sponsorship") or "")[:40],
                }
            )

        system = (
            "You are a helpful career coach. "
            "Return ONLY a single JSON object (no markdown, no prose). "
            "The JSON MUST include exactly these keys: "
            "career_summary, recommended_roles, recommended_skills, ranked_job_uids, job_reasons. "
            "Do not omit keys. Do not return extra keys. "
            "career_summary must be a short paragraph (<= 800 chars). "
            "recommended_roles must be an array of strings (<= 6). "
            "recommended_skills must be an array of strings (<= 10). "
            "ranked_job_uids must be an array of strings (EXACTLY {limit} items). "
            "job_reasons must be an object mapping uid -> reason (<= 200 chars each). "
        ).format(limit=limit)

        resume_snippet = (resume_text or "").strip()
        if len(resume_snippet) > 3000:
            resume_snippet = resume_snippet[:3000]

        # Single-call mode: assume candidate_jobs are already pre-filtered/ranked heuristically.
        # Do one final rerank + structured summary over the provided candidate list.
        shortlist_jobs = compact_jobs
        user = (
            "Given the user profile and the candidate internship listings, select and rank the best matches.\n"
            "Constraints:\n"
            f"- Return EXACTLY {limit} ranked_job_uids.\n"
            "- Only use uids that appear in candidate_jobs.\n"
            "- Reasons must reference specific user profile signals or listing fields (title/category/location).\n\n"
            f"USER_PROFILE: {user_profile}\n\n"
            f"RESUME_SNIPPET (optional):\n{resume_snippet}\n\n"
            "CANDIDATE_JOBS (JSON):\n"
            + json.dumps(shortlist_jobs, ensure_ascii=False, separators=(",", ":"))
        )

        parsed = await self._chat_json(system=system, user=user)

        career_summary = parsed.get("career_summary")
        career_summary_str = career_summary.strip() if isinstance(career_summary, str) else ""
        if not career_summary_str:
            career_summary_str = (user_profile or "Career recommendations generated.")[:800]

        recommended_roles = _as_str_list(parsed.get("recommended_roles"), limit=6)
        recommended_skills = _as_str_list(parsed.get("recommended_skills"), limit=10)
        ranked_job_uids = _as_str_list(parsed.get("ranked_job_uids"), limit=limit)
        job_reasons = _as_str_map(parsed.get("job_reasons"), limit=limit)

        # Enforce exact-length ranking when possible.
        available_uids = [j.get("uid") for j in shortlist_jobs if isinstance(j.get("uid"), str)]
        available_set = {uid for uid in available_uids if uid}

        filtered: list[str] = []
        for uid in ranked_job_uids:
            if uid in available_set and uid not in filtered:
                filtered.append(uid)
            if len(filtered) >= limit:
                break

        for uid in available_uids:
            if uid and uid not in filtered:
                filtered.append(uid)
            if len(filtered) >= limit:
                break

        if not job_reasons:
            job_reasons = {uid: "Recommended based on your profile." for uid in filtered[:limit]}

        return CareerRecommendations(
            career_summary=career_summary_str[:800],
            recommended_roles=recommended_roles,
            recommended_skills=recommended_skills,
            ranked_job_uids=tuple(filtered[:limit]),
            job_reasons=job_reasons,
        )
