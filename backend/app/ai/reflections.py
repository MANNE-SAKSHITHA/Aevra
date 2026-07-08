"""
Generates a short reflective observation about patterns across a user's
recent entries, using the same local Ollama model as enrichment. Runs as a
background task so the request returns immediately.
"""
import logging

import httpx

from app.ai.ollama_client import OllamaUnavailableError
from app.config import get_settings
from app.database import SessionLocal
from app.models import Entry, Reflection

logger = logging.getLogger("aevra.ai.reflections")
settings = get_settings()

REFLECTION_SYSTEM_PROMPT = """You are a thoughtful journaling companion. \
You will be given a list of recent journal entry summaries and moods. \
Notice ONE genuine pattern across them -- something about mood, a recurring \
topic, a person, or a change over time -- and write it as a single warm, \
specific, second-person sentence (e.g. "You feel happiest during travel," \
or "Conversations with Priya keep coming up as a source of energy."). \
Do not be generic or vague. Respond with ONLY that one sentence, no preamble, \
no quotation marks."""


def _build_context(entries: list[Entry]) -> str:
    lines = []
    for entry in entries:
        mood = entry.ai_mood or "unknown mood"
        summary = entry.ai_summary or entry.content[:150]
        lines.append(f"- ({mood}) {summary}")
    return "\n".join(lines)


def run_reflection_generation(user_id: str) -> None:
    db = SessionLocal()
    try:
        entries = (
            db.query(Entry)
            .filter(Entry.owner_id == user_id)
            .order_by(Entry.entry_date.desc())
            .limit(20)
            .all()
        )
        if len(entries) < 3:
            return

        context = _build_context(entries)
        payload = {
            "model": settings.OLLAMA_MODEL,
            "prompt": context,
            "system": REFLECTION_SYSTEM_PROMPT,
            "stream": False,
            "options": {"temperature": 0.6},
        }

        try:
            response = httpx.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json=payload,
                timeout=settings.OLLAMA_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            text = response.json().get("response", "").strip().strip('"')
        except httpx.ConnectError as exc:
            raise OllamaUnavailableError(f"Could not connect to Ollama: {exc}") from exc
        except httpx.HTTPError as exc:
            raise OllamaUnavailableError(f"Ollama request failed: {exc}") from exc

        if not text:
            logger.warning("Reflection generation for user %s produced empty output", user_id)
            return

        reflection = Reflection(owner_id=user_id, content=text, based_on_entry_count=len(entries))
        db.add(reflection)
        db.commit()

    except OllamaUnavailableError as exc:
        # There's no per-request status to report here since this endpoint
        # returns 202 immediately -- just log it. The frontend simply won't
        # see a new reflection appear, and can offer a retry.
        logger.warning("Reflection generation failed for user %s: %s", user_id, exc)
    finally:
        db.close()
