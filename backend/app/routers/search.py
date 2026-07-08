from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.ai import embeddings
from app.ai.ollama_client import is_available
from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Entry, User
from app.schemas import EntryOut, GraphEdge, GraphNode, GraphResponse

router = APIRouter(prefix="/api", tags=["ai"])
settings = get_settings()


class SemanticSearchResult(BaseModel):
    entry: EntryOut
    relevance: float  # 0-1, higher is more relevant


class AIStatus(BaseModel):
    ollama_available: bool
    ollama_model: str
    enrichment_enabled: bool


@router.get("/graph", response_model=GraphResponse)
def memory_graph(
    limit: int = Query(default=300, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns a bipartite graph of the user's entries and tags: an edge exists
    between an entry and every tag attached to it. Tags stand in for the
    people/places/topics the original spec calls out separately -- since
    Phase 2's AI enrichment already extracts things like "lisbon" or
    "rahul" as tags, this graph surfaces those relationships without
    needing a whole separate People/Place schema.
    """
    entries = (
        db.query(Entry)
        .options(joinedload(Entry.tags))
        .filter(Entry.owner_id == current_user.id)
        .order_by(Entry.entry_date.desc())
        .limit(limit)
        .all()
    )

    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    tag_counts: dict[str, int] = {}
    seen_tags: dict[str, str] = {}  # tag_id -> label

    for entry in entries:
        label = entry.title or (entry.content[:40] + ("…" if len(entry.content) > 40 else ""))
        nodes.append(
            GraphNode(
                id=f"entry:{entry.id}",
                label=label,
                type="entry",
                entry_date=entry.entry_date,
                mood=entry.ai_mood,
            )
        )
        for tag in entry.tags:
            seen_tags[tag.id] = tag.name
            tag_counts[tag.id] = tag_counts.get(tag.id, 0) + 1
            edges.append(GraphEdge(source=f"entry:{entry.id}", target=f"tag:{tag.id}"))

    for tag_id, label in seen_tags.items():
        nodes.append(
            GraphNode(id=f"tag:{tag_id}", label=label, type="tag", tag_count=tag_counts[tag_id])
        )

    return GraphResponse(nodes=nodes, edges=edges)


@router.get("/ai/status", response_model=AIStatus)
def ai_status(current_user: User = Depends(get_current_user)):
    return AIStatus(
        ollama_available=is_available(),
        ollama_model=settings.OLLAMA_MODEL,
        enrichment_enabled=settings.AI_ENRICHMENT_ENABLED,
    )


@router.get("/search/semantic", response_model=list[SemanticSearchResult])
def semantic_search(
    q: str = Query(min_length=1),
    limit: int = Query(default=settings.SEMANTIC_SEARCH_DEFAULT_RESULTS, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Natural-language search over the user's own entries, e.g.
    "when was I happiest" or "trip to Portugal", ranked by embedding
    similarity rather than exact keyword match.
    """
    hits = embeddings.semantic_search(current_user.id, q, limit)
    if not hits:
        return []

    entries_by_id = {
        e.id: e
        for e in db.query(Entry)
        .filter(Entry.owner_id == current_user.id, Entry.id.in_([h["id"] for h in hits]))
        .all()
    }

    results = []
    for hit in hits:
        entry = entries_by_id.get(hit["id"])
        if entry is None:
            continue  # entry was deleted after being indexed but before cleanup ran
        distance = hit["distance"] or 0.0
        relevance = max(0.0, 1.0 - distance)  # cosine-ish distance -> similarity
        results.append(SemanticSearchResult(entry=entry, relevance=round(relevance, 4)))

    return results
