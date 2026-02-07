from __future__ import annotations

import logging


def configure_logging(env: str = "dev") -> None:
    level = logging.DEBUG if env.lower() in {"dev", "local"} else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )
