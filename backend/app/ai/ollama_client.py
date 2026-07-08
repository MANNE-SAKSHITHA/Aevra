"""
Thin client around a locally-running Ollama server.

Ollama is not bundled or auto-installed -- it's a separate local install
(https://ollama.com) the user runs themselves, per the project's "no paid
APIs, everything local" requirement. This module only talks to whatever
Ollama instance is configured in Settings.OLLAMA_BASE_URL and fails loudly
(but gracefully) when it isn't reachable, rather than blocking the rest of
the app.
"""
import json
import logging
import re

import httpx

from app.config import get_settings

logger = logging.getLogger("aevra.ai.ollama")
settings = get_settings()


class OllamaUnavailableError(Exception):
    """Raised when Ollama can't be reached or returns an unusable response."""


ENRICHMENT_SYSTEM_PROMPT = """You are a thoughtful, private journaling assistant. \
Given a journal entry, extract structured metadata about it. \
Respond with ONLY a single JSON object, no prose, no markdown fences, matching exactly this shape:

{
  "title": "a short, evocative title (max 8 words)",
  "summary": "a 1-2 sentence summary written in third person",
  "mood": "one word describing overall mood, e.g. joyful, anxious, calm, nostalgic",
  "emotion": "the single most dominant emotion, e.g. happiness, gratitude, stress",
  "tags": ["3 to 6 short lowercase tags capturing people, places, topics, or themes"]
}"""


def _extract_json(raw: str) -> dict | list:
    """Ollama models sometimes wrap JSON in markdown fences despite instructions."""
    cleaned = raw.strip()
    fenced = re.search(r"```(?:json)?\s*([\[{].*[\]}])\s*```", cleaned, re.DOTALL)
    if fenced:
        cleaned = fenced.group(1)
    else:
        # fall back to the first {...} or [...] block in the response
        brace_match = re.search(r"[\[{].*[\]}]", cleaned, re.DOTALL)
        if brace_match:
            cleaned = brace_match.group(0)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise OllamaUnavailableError(f"Model returned unparsable JSON: {exc}") from exc


def enrich_entry(content: str) -> dict:
    """
    Calls the local Ollama model to derive title/summary/mood/emotion/tags
    for a journal entry's content. Raises OllamaUnavailableError on any
    failure (connection refused, timeout, bad JSON) so callers can degrade
    gracefully instead of crashing entry creation.
    """
    payload = {
        "model": settings.OLLAMA_MODEL,
        "prompt": content,
        "system": ENRICHMENT_SYSTEM_PROMPT,
        "format": "json",
        "stream": False,
        "options": {"temperature": 0.4},
    }

    try:
        response = httpx.post(
            f"{settings.OLLAMA_BASE_URL}/api/generate",
            json=payload,
            timeout=settings.OLLAMA_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except httpx.ConnectError as exc:
        raise OllamaUnavailableError(
            f"Could not connect to Ollama at {settings.OLLAMA_BASE_URL}. "
            "Is it installed and running? (`ollama serve`)"
        ) from exc
    except httpx.TimeoutException as exc:
        raise OllamaUnavailableError("Ollama timed out generating a response.") from exc
    except httpx.HTTPStatusError as exc:
        raise OllamaUnavailableError(
            f"Ollama returned HTTP {exc.response.status_code}: {exc.response.text[:200]}"
        ) from exc

    body = response.json()
    raw_text = body.get("response", "")
    if not raw_text:
        raise OllamaUnavailableError("Ollama returned an empty response.")

    parsed = _extract_json(raw_text)

    result = {
        "title": str(parsed.get("title") or "").strip()[:200] or None,
        "summary": str(parsed.get("summary") or "").strip() or None,
        "mood": str(parsed.get("mood") or "").strip().lower()[:50] or None,
        "emotion": str(parsed.get("emotion") or "").strip().lower()[:50] or None,
        "tags": [],
    }

    raw_tags = parsed.get("tags")
    if isinstance(raw_tags, list):
        result["tags"] = [str(t).strip().lower() for t in raw_tags if str(t).strip()][:6]

    return result


def is_available() -> bool:
    """Quick health check used by the /api/ai/status endpoint."""
    try:
        response = httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=3.0)
        return response.status_code == 200
    except httpx.HTTPError:
        return False
