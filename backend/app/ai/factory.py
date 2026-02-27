from __future__ import annotations

from app.ai.base import AIProvider
from app.ai.mock import provider as mock_provider
from app.ai.ollama import provider as ollama_provider
from app.core.config import settings


def get_ai_provider() -> AIProvider:
    name = (settings.AI_PROVIDER or "mock").strip().lower()

    if name == "mock":
        return mock_provider()

    if name == "ollama":
        return ollama_provider()

    # Stubs for future integration: keep the interface stable.
    if name in {"openai", "gemini", "deepseek"}:
        raise NotImplementedError(
            f"AI provider '{name}' is not integrated yet. Set AI_PROVIDER=mock for now."
        )

    raise ValueError(f"Unknown AI provider: {name}")
