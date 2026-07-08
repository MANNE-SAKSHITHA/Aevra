"""
Local semantic search over journal entries, backed by ChromaDB.

Uses ChromaDB's built-in embedding function (a MiniLM model run via
onnxruntime) rather than sentence-transformers + torch: same model family,
far smaller footprint (no CUDA libraries, no multi-GB install), and it still
runs fully offline once the ~90MB model file has been cached on first use.

Each user gets their own collection (`entries_<user_id>`) so embeddings and
search results are naturally isolated per-account, mirroring the SQL-level
row ownership checks in the rest of the API.
"""
import logging

import chromadb
from chromadb.utils import embedding_functions

from app.config import get_settings

logger = logging.getLogger("aevra.ai.embeddings")
settings = get_settings()

_client: chromadb.ClientAPI | None = None
_embedding_function = None


def _get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
    return _client


def _get_embedding_function():
    global _embedding_function
    if _embedding_function is None:
        _embedding_function = embedding_functions.DefaultEmbeddingFunction()
    return _embedding_function


def _collection_name(user_id: str) -> str:
    # Chroma collection names must be 3-63 chars, alnum/underscore/hyphen.
    return f"entries_{user_id.replace('-', '')}"


def _get_collection(user_id: str):
    return _get_client().get_or_create_collection(
        name=_collection_name(user_id),
        embedding_function=_get_embedding_function(),
    )


def index_entry(user_id: str, entry_id: str, text: str, metadata: dict) -> None:
    """Add or update an entry's embedding. Safe to call repeatedly (upsert)."""
    collection = _get_collection(user_id)
    collection.upsert(ids=[entry_id], documents=[text], metadatas=[metadata])


def remove_entry(user_id: str, entry_id: str) -> None:
    collection = _get_collection(user_id)
    try:
        collection.delete(ids=[entry_id])
    except Exception:
        # Deleting a non-existent id shouldn't break entry deletion.
        logger.warning("Could not remove entry %s from vector index", entry_id)


def semantic_search(user_id: str, query: str, limit: int) -> list[dict]:
    """Returns [{id, distance, metadata}, ...] ordered by relevance (closest first)."""
    collection = _get_collection(user_id)
    if collection.count() == 0:
        return []

    results = collection.query(
        query_texts=[query],
        n_results=min(limit, collection.count()),
    )

    hits = []
    ids = results.get("ids", [[]])[0]
    distances = results.get("distances", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    for i, entry_id in enumerate(ids):
        hits.append(
            {
                "id": entry_id,
                "distance": distances[i] if i < len(distances) else None,
                "metadata": metadatas[i] if i < len(metadatas) else {},
            }
        )
    return hits
