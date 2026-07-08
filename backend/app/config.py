"""
Central application configuration.

All values can be overridden by environment variables or a `.env` file placed
next to this package (see `.env.example`). Nothing here is a placeholder --
these are real, working defaults suitable for local development on Windows,
macOS, or Linux with zero external services required.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- General ---
    APP_NAME: str = "Aevra"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # --- Database ---
    # SQLite by default (zero setup). Point DATABASE_URL at a Postgres DSN
    # (e.g. postgresql+psycopg2://user:pass@localhost/aevra) to switch.
    DATABASE_URL: str = "sqlite:///./aevra.db"

    # --- Auth / JWT ---
    # IMPORTANT: override this via .env in any real deployment.
    JWT_SECRET_KEY: str = "dev-secret-key-change-me-in-env-file-please"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days

    # --- CORS ---
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    # Extra safety net for LAN access (e.g. opening the app via a
    # 192.168.x.x / 10.x.x.x address instead of localhost). The frontend
    # normally proxies API calls same-origin via Next.js rewrites, so this
    # regex mainly matters if something talks to the backend directly.
    CORS_ORIGIN_REGEX: str = r"^http://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$"

    # --- Storage ---
    STORAGE_ROOT: str = "./storage"
    UPLOADS_DIR: str = "uploads"
    MEDIA_DIR: str = "media"
    AUDIO_DIR: str = "audio"
    THUMBNAILS_DIR: str = "thumbnails"

    # --- Pagination ---
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # --- Local AI (Ollama) ---
    # Ollama must be installed and running separately (https://ollama.com),
    # with a model pulled, e.g.: `ollama pull llama3.1`
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1"
    OLLAMA_TIMEOUT_SECONDS: float = 60.0
    AI_ENRICHMENT_ENABLED: bool = True

    # --- Embeddings / semantic search (ChromaDB) ---
    # Uses ChromaDB's bundled MiniLM ONNX model, run entirely locally via
    # onnxruntime -- no torch, no GPU, no paid API. The model file (~90MB)
    # downloads once on first use and is cached under CHROMA_PERSIST_DIR.
    CHROMA_PERSIST_DIR: str = "./storage/chroma"
    SEMANTIC_SEARCH_DEFAULT_RESULTS: int = 10

    # --- Speech-to-text (faster-whisper) ---
    # CTranslate2-based Whisper implementation -- no torch dependency.
    # Model weights (~75MB for "small") download from Hugging Face on first
    # use and are cached locally afterwards.
    WHISPER_MODEL_SIZE: str = "small"
    WHISPER_DEVICE: str = "cpu"
    WHISPER_COMPUTE_TYPE: str = "int8"

    # --- Text-to-speech (Piper) ---
    # Voice model files (.onnx + .onnx.json) must exist under PIPER_VOICES_DIR.
    # The app will try to auto-download the default voice on first use; if
    # that fails (e.g. no internet), see the README for the manual download
    # link and place the files there yourself.
    PIPER_VOICES_DIR: str = "./storage/voices"
    PIPER_DEFAULT_VOICE: str = "en_US-lessac-medium"


@lru_cache
def get_settings() -> Settings:
    return Settings()
