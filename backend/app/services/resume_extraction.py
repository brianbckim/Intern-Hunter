from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path


MAX_EXTRACTED_TEXT_LEN = 200_000


def _normalize_text(value: str) -> str:
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = value.replace("\u00a0", " ")
    value = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    value = re.sub(r"[ \t]{2,}", " ", value)
    value = value.strip()
    if len(value) > MAX_EXTRACTED_TEXT_LEN:
        value = value[:MAX_EXTRACTED_TEXT_LEN]
    return value


def extract_resume_text(file_path: Path) -> str | None:
    """Extract text from a resume file.

    Supported:
    - .pdf via pdfminer.six
    - .docx via python-docx
    """

    ext = file_path.suffix.lower()

    try:
        if ext == ".pdf":
            from pdfminer.high_level import extract_text  # type: ignore[import-not-found]

            raw = extract_text(str(file_path)) or ""
            text = _normalize_text(raw)
            return text or None

        if ext == ".docx":
            from docx import Document  # type: ignore[import-not-found]

            doc = Document(str(file_path))
            parts: list[str] = []
            for p in doc.paragraphs:
                if p.text:
                    parts.append(p.text)

            for table in doc.tables:
                for row in table.rows:
                    for cell in row.cells:
                        if cell.text:
                            parts.append(cell.text)

            raw = "\n".join(parts)
            text = _normalize_text(raw)
            return text or None

        if ext == ".doc":
            # Legacy Word format (.doc). Prefer a small external tool rather than
            # adding heavy Python dependencies.
            antiword = shutil.which("antiword")
            if not antiword:
                return None

            proc = subprocess.run(
                [antiword, str(file_path)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=20,
                check=False,
            )
            if proc.returncode != 0:
                return None

            raw = proc.stdout.decode("utf-8", errors="ignore")
            text = _normalize_text(raw)
            return text or None

    except Exception:
        return None

    return None
