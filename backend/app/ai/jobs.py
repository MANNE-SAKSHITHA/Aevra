"""
Background tasks for the two Phase 3 AI jobs: transcribing an uploaded
voice-journal recording (Whisper) and synthesizing narration audio for an
entry (Piper). Mirrors the pattern used for AI enrichment in Phase 2 --
each function opens its own DB session since it runs after the request's
session has already closed.
"""
import logging
from pathlib import Path

from app.ai.narration import NarrationUnavailableError, synthesize
from app.ai.transcription import TranscriptionUnavailableError, transcribe
from app.config import get_settings
from app.database import SessionLocal
from app.models import Media

logger = logging.getLogger("aevra.ai.jobs")
settings = get_settings()


def run_transcription(media_id: str) -> None:
    db = SessionLocal()
    try:
        media = db.get(Media, media_id)
        if media is None:
            return

        full_path = Path(settings.STORAGE_ROOT) / media.file_path
        try:
            text, duration = transcribe(str(full_path))
            media.transcript = text
            media.duration_seconds = duration
            media.status = "completed"
            media.error_message = None
        except TranscriptionUnavailableError as exc:
            logger.warning("Transcription failed for media %s: %s", media_id, exc)
            media.status = "failed"
            media.error_message = str(exc)

        db.commit()
    finally:
        db.close()


def run_narration(media_id: str, text: str, voice: str | None) -> None:
    db = SessionLocal()
    try:
        media = db.get(Media, media_id)
        if media is None:
            return

        full_path = Path(settings.STORAGE_ROOT) / media.file_path
        try:
            synthesize(text, str(full_path), voice_name=voice)
            media.size_bytes = full_path.stat().st_size if full_path.exists() else 0
            media.status = "completed"
            media.error_message = None
        except NarrationUnavailableError as exc:
            logger.warning("Narration failed for media %s: %s", media_id, exc)
            media.status = "failed"
            media.error_message = str(exc)

        db.commit()
    finally:
        db.close()
