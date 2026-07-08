"""
Local speech-to-text via faster-whisper.

Deliberately using faster-whisper (CTranslate2 backend) rather than
OpenAI's original `openai-whisper` package: same Whisper model weights,
but no torch dependency -- consistent with the same "avoid multi-GB
CUDA-bundled installs for CPU-only local use" decision made for embeddings
in Phase 2. Model weights download from Hugging Face on first use (a few
hundred MB depending on model size) and are cached under ~/.cache afterward.
"""
import logging
import threading

from faster_whisper import WhisperModel

from app.config import get_settings

logger = logging.getLogger("aevra.ai.transcription")
settings = get_settings()

_model: WhisperModel | None = None
_model_lock = threading.Lock()


class TranscriptionUnavailableError(Exception):
    """Raised when the Whisper model can't be loaded or transcription fails."""


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:  # re-check inside the lock
                try:
                    _model = WhisperModel(
                        settings.WHISPER_MODEL_SIZE,
                        device=settings.WHISPER_DEVICE,
                        compute_type=settings.WHISPER_COMPUTE_TYPE,
                    )
                except Exception as exc:
                    raise TranscriptionUnavailableError(
                        f"Could not load Whisper model '{settings.WHISPER_MODEL_SIZE}': {exc}. "
                        "This model downloads from Hugging Face on first use -- check your "
                        "internet connection, or try a smaller WHISPER_MODEL_SIZE (e.g. 'base')."
                    ) from exc
    return _model


def transcribe(audio_path: str) -> tuple[str, float]:
    """
    Returns (transcript_text, duration_seconds).
    Raises TranscriptionUnavailableError on any failure so callers can
    record a clear per-file error instead of crashing the upload.
    """
    model = _get_model()
    try:
        segments, info = model.transcribe(audio_path, beam_size=5, vad_filter=True)
        text = " ".join(segment.text.strip() for segment in segments).strip()
        return text, info.duration
    except Exception as exc:
        raise TranscriptionUnavailableError(f"Transcription failed: {exc}") from exc
