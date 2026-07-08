"""
Local text-to-speech via Piper.

Piper voice models (.onnx + .onnx.json) are not bundled with this repo --
they need to exist under settings.PIPER_VOICES_DIR. On first use this
module tries to fetch the configured default voice automatically from
Hugging Face; if that fails (offline, blocked network, etc.) it raises a
clear error pointing at the manual-download instructions in the README
rather than crashing narration requests.
"""
import logging
import threading
import wave
from pathlib import Path

import httpx
from piper import PiperVoice

from app.config import get_settings

logger = logging.getLogger("aevra.ai.narration")
settings = get_settings()

_voices: dict[str, PiperVoice] = {}
_voices_lock = threading.Lock()

# Hugging Face hosts the official Piper voice files under this repo layout:
# https://huggingface.co/rhasspy/piper-voices/tree/main/<lang>/<lang_REGION>/<name>/<quality>
_HF_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main"
_VOICE_PATHS = {
    "en_US-lessac-medium": "en/en_US/lessac/medium/en_US-lessac-medium",
}


class NarrationUnavailableError(Exception):
    """Raised when a Piper voice can't be loaded/downloaded or synthesis fails."""


def _voice_paths(voice_name: str) -> tuple[Path, Path]:
    voices_dir = Path(settings.PIPER_VOICES_DIR)
    voices_dir.mkdir(parents=True, exist_ok=True)
    return voices_dir / f"{voice_name}.onnx", voices_dir / f"{voice_name}.onnx.json"


def _try_download_voice(voice_name: str, model_path: Path, config_path: Path) -> None:
    rel_path = _VOICE_PATHS.get(voice_name)
    if rel_path is None:
        raise NarrationUnavailableError(
            f"No known download location for voice '{voice_name}'. "
            "Download it manually from https://huggingface.co/rhasspy/piper-voices "
            f"and place it at {model_path} / {config_path}."
        )

    try:
        for url, dest in (
            (f"{_HF_BASE}/{rel_path}.onnx", model_path),
            (f"{_HF_BASE}/{rel_path}.onnx.json", config_path),
        ):
            with httpx.stream("GET", url, timeout=120.0, follow_redirects=True) as resp:
                resp.raise_for_status()
                with open(dest, "wb") as f:
                    for chunk in resp.iter_bytes():
                        f.write(chunk)
        logger.info("Downloaded Piper voice '%s'", voice_name)
    except httpx.HTTPError as exc:
        # Clean up any partial file so we don't load a corrupt voice next time.
        for p in (model_path, config_path):
            if p.exists():
                p.unlink()
        raise NarrationUnavailableError(
            f"Could not download Piper voice '{voice_name}' ({exc}). "
            f"Download it manually from https://huggingface.co/rhasspy/piper-voices/tree/main/"
            f"{rel_path.rsplit('/', 1)[0]} and place the .onnx/.onnx.json files at "
            f"{settings.PIPER_VOICES_DIR}/"
        ) from exc


def _get_voice(voice_name: str) -> PiperVoice:
    if voice_name in _voices:
        return _voices[voice_name]

    with _voices_lock:
        if voice_name in _voices:  # re-check inside the lock
            return _voices[voice_name]

        model_path, config_path = _voice_paths(voice_name)
        if not (model_path.exists() and config_path.exists()):
            _try_download_voice(voice_name, model_path, config_path)

        try:
            voice = PiperVoice.load(str(model_path), str(config_path))
        except Exception as exc:
            raise NarrationUnavailableError(f"Could not load Piper voice '{voice_name}': {exc}") from exc

        _voices[voice_name] = voice
        return voice


def synthesize(text: str, output_path: str, voice_name: str | None = None) -> None:
    """Writes a WAV file at output_path narrating `text`."""
    voice = _get_voice(voice_name or settings.PIPER_DEFAULT_VOICE)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    try:
        with wave.open(output_path, "wb") as wav_file:
            voice.synthesize_wav(text, wav_file)
    except Exception as exc:
        raise NarrationUnavailableError(f"Speech synthesis failed: {exc}") from exc
