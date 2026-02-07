from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.db.mongo import connect_to_mongo, disconnect_from_mongo


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(env=settings.ENV)
    await connect_to_mongo()
    yield
    await disconnect_from_mongo()


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

cors_origins = settings.CORS_ORIGINS_list
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_PREFIX)
