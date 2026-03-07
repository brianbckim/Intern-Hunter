from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo


_EASTERN = ZoneInfo("America/New_York")


def now_eastern() -> datetime:
    """Return a timezone-aware datetime in US Eastern time (America/New_York)."""
    return datetime.now(_EASTERN)
