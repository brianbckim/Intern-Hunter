from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


def convert_doc_to_pdf(file_path: Path, output_dir: Path) -> Path | None:
    """Convert legacy .doc file to PDF using LibreOffice/soffice if available."""

    office_bin = shutil.which("soffice") or shutil.which("libreoffice")
    if not office_bin:
        return None

    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        process = subprocess.run(
            [
                office_bin,
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(output_dir),
                str(file_path),
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=45,
            check=False,
        )
    except Exception:
        return None

    if process.returncode != 0:
        return None

    expected = output_dir / f"{file_path.stem}.pdf"
    if expected.exists():
        return expected

    candidates = sorted(output_dir.glob("*.pdf"), key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0] if candidates else None
