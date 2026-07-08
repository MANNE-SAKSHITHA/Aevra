"""
Ties together the two local AI pieces (Ollama enrichment + ChromaDB
indexing) into one function that runs as a FastAPI background task after an
entry is created or edited, so the request itself returns instantly.
"""
import logging

from sqlalchemy.orm import Session

from app.ai import embeddings
from app.ai.ollama_client import OllamaUnavailableError, enrich_entry
from app.config import get_settings
from app.database import SessionLocal
from app.models import Entry
from app.services.tags import resolve_tags

logger = logging.getLogger("aevra.ai.enrichment")
settings = get_settings()


def run_enrichment(entry_id: str) -> None:
    """
    Runs in a background task (its own DB session, since the request's
    session is already closed by the time this executes).
    """
    db: Session = SessionLocal()
    try:
        entry = db.get(Entry, entry_id)
        if entry is None:
            return  # entry was deleted before enrichment ran

        if settings.AI_ENRICHMENT_ENABLED:
            try:
                result = enrich_entry(entry.content)
                entry.title = entry.title or result["title"]
                entry.ai_summary = result["summary"]
                entry.ai_mood = result["mood"]
                entry.ai_emotion = result["emotion"]
                entry.ai_status = "completed"
                entry.ai_error = None

                if result["tags"]:
                    new_tags = resolve_tags(db, entry.owner_id, result["tags"])
                    entry.tags = list({t.id: t for t in (*entry.tags, *new_tags)}.values())
            except OllamaUnavailableError as exc:
                logger.warning("Enrichment failed for entry %s: %s", entry_id, exc)
                entry.ai_status = "failed"
                entry.ai_error = str(exc)
        else:
            entry.ai_status = "disabled"

        db.commit()
        db.refresh(entry)

        # Index for semantic search regardless of whether the LLM step
        # succeeded -- raw content is still searchable even if enrichment failed
        # or is disabled.
        try:
            embeddings.index_entry(
                user_id=entry.owner_id,
                entry_id=entry.id,
                text=f"{entry.title or ''}\n{entry.content}",
                metadata={
                    "owner_id": entry.owner_id,
                    "entry_date": entry.entry_date.isoformat(),
                },
            )
        except Exception:
            logger.exception("Failed to index entry %s for semantic search", entry_id)

    finally:
        db.close()
