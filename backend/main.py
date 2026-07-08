"""
Aevra backend entrypoint.

Run with:
    python main.py

This creates the SQLite database tables on first run (no separate migration
step required to get started), sets up local storage folders, and serves the
API on http://localhost:8000 with interactive docs at /docs.
"""
import logging
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import Base, engine
from app.routers import auth, entries, insights, media, search

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("aevra")

settings = get_settings()


def ensure_storage_dirs() -> None:
    root = Path(settings.STORAGE_ROOT)
    for sub in (settings.UPLOADS_DIR, settings.MEDIA_DIR, settings.AUDIO_DIR, settings.THUMBNAILS_DIR):
        (root / sub).mkdir(parents=True, exist_ok=True)
    Path(settings.CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.PIPER_VOICES_DIR).mkdir(parents=True, exist_ok=True)
    logger.info("Storage directories ready at %s", root.resolve())


def create_app() -> FastAPI:
    ensure_storage_dirs()

    # Phase 1: create tables directly. A future phase swaps this for Alembic
    # migrations (scaffolding included under /migrations) without changing
    # the models themselves.
    Base.metadata.create_all(bind=engine)
    logger.info("Database ready at %s", settings.DATABASE_URL)

    app = FastAPI(
        title=settings.APP_NAME,
        description="Aevra — Your life, beautifully remembered.",
        version="0.1.0",
        debug=settings.DEBUG,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_origin_regex=settings.CORS_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.mount("/storage", StaticFiles(directory=settings.STORAGE_ROOT), name="storage")

    app.include_router(auth.router)
    app.include_router(entries.router)
    app.include_router(search.router)
    app.include_router(media.router)
    app.include_router(insights.router)

    @app.get("/api/health", tags=["health"])
    def health_check():
        return {"status": "ok", "app": settings.APP_NAME, "environment": settings.ENVIRONMENT}

    return app


app = create_app()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
