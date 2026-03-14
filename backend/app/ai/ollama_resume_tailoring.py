from __future__ import annotations

import json
import re

import httpx

from app.ai.base import TailoredResumeDraft
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
            stripped = item.strip()
            if stripped:
                out.append(stripped)
        if len(out) >= limit:
            break
    return tuple(out)


class OllamaResumeTailoringProvider:
    async def tailor_resume_for_job(
        self,
        *,
        user_profile: str,
        resume_text: str,
        job_title: str,
        job_company: str | None,
        job_description: str,
    ) -> TailoredResumeDraft:
        company = (job_company or "Unknown company").strip() or "Unknown company"
        trimmed_resume = (resume_text or "").strip()[:5000]
        trimmed_job_description = (job_description or "").strip()[:5000]

        system = (
            "You are a helpful career coach tailoring resumes to internship job descriptions. "
            "Return ONLY a single JSON object. No markdown and no prose outside JSON. "
            "The JSON MUST include exactly these keys: summary, tailored_resume, targeted_edits, keywords_to_highlight. "
            "summary must be a short paragraph (<= 500 chars). "
            "tailored_resume must be a plain-text resume draft tailored to the target job (<= 6000 chars). "
            "targeted_edits must be an array of strings (<= 6). "
            "keywords_to_highlight must be an array of strings (<= 10)."
        )
        user = (
            f"USER_PROFILE: {user_profile}\n\n"
            f"TARGET_ROLE: {job_title} at {company}\n\n"
            f"JOB_DESCRIPTION:\n{trimmed_job_description}\n\n"
            f"CURRENT_RESUME:\n{trimmed_resume}\n\n"
            "Task:\n"
            "- Rewrite the resume into a stronger tailored draft for this target role.\n"
            "- Preserve factual information from the original resume; do not invent experience, employers, degrees, or technologies.\n"
            "- Improve wording, ordering, emphasis, and keyword alignment.\n"
            "- targeted_edits should explain the main changes made.\n"
            "- keywords_to_highlight should list the most important JD-aligned keywords visible in the rewritten draft."
        )

        payload = {
            "model": settings.OLLAMA_MODEL,
            "stream": False,
            "format": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "summary": {"type": "string"},
                    "tailored_resume": {"type": "string"},
                    "targeted_edits": {"type": "array", "items": {"type": "string"}},
                    "keywords_to_highlight": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["summary", "tailored_resume", "targeted_edits", "keywords_to_highlight"],
            },
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "options": {"temperature": 0.2},
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

        parsed = _parse_json_object(content)

        summary = parsed.get("summary")
        summary_str = summary.strip() if isinstance(summary, str) else ""
        if not summary_str:
            summary_str = f"Tailored resume draft for {job_title} at {company}."

        tailored_resume = parsed.get("tailored_resume")
        tailored_resume_str = tailored_resume.strip() if isinstance(tailored_resume, str) else ""
        if not tailored_resume_str:
            tailored_resume_str = trimmed_resume or "No tailored resume draft generated."

        targeted_edits = _as_str_list(parsed.get("targeted_edits"), limit=6)
        keywords_to_highlight = _as_str_list(parsed.get("keywords_to_highlight"), limit=10)

        return TailoredResumeDraft(
            summary=summary_str[:500],
            tailored_resume=tailored_resume_str[:6000],
            targeted_edits=targeted_edits,
            keywords_to_highlight=keywords_to_highlight,
        )