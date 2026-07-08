import math
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.ai import embeddings
from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Entry, Media, Tag, User
from app.schemas import EntryCreate, EntryOut, EntryUpdate, NarrateRequest, PaginatedEntries
from app.services.tags import resolve_tags

router = APIRouter(prefix="/api/entries", tags=["entries"])
settings = get_settings()


def _resolve_tags(db: Session, owner_id: str, tag_names: list[str]) -> list[Tag]:
    return resolve_tags(db, owner_id, tag_names)


@router.post("", response_model=EntryOut, status_code=status.HTTP_201_CREATED)
def create_entry(
    payload: EntryCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = Entry(
        owner_id=current_user.id,
        title=payload.title,
        content=payload.content,
        entry_date=payload.entry_date or datetime.utcnow(),
        is_favorite=payload.is_favorite,
        ai_status="pending",
    )
    entry.tags = _resolve_tags(db, current_user.id, payload.tags)
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Runs after the response is sent -- title/summary/mood/tags and the
    # semantic-search index populate a few seconds later without the
    # person waiting on the local LLM call.
    from app.ai.enrichment import run_enrichment

    background_tasks.add_task(run_enrichment, entry.id)

    return entry


@router.get("", response_model=PaginatedEntries)
def list_entries(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=settings.DEFAULT_PAGE_SIZE, ge=1, le=settings.MAX_PAGE_SIZE),
    search: str | None = Query(default=None, description="Full-text search over title/content"),
    tag: str | None = Query(default=None, description="Filter by a single tag name"),
    favorite: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Entry).filter(Entry.owner_id == current_user.id)

    if search:
        like = f"%{search}%"
        query = query.filter(or_(Entry.title.ilike(like), Entry.content.ilike(like)))

    if tag:
        query = query.join(Entry.tags).filter(Tag.name == tag.strip().lower())

    if favorite is not None:
        query = query.filter(Entry.is_favorite == favorite)

    total = query.distinct().count()
    items = (
        query.distinct()
        .order_by(Entry.entry_date.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    pages = math.ceil(total / page_size) if total else 0
    return PaginatedEntries(items=items, total=total, page=page, page_size=page_size, pages=pages)


def _get_owned_entry(db: Session, entry_id: str, owner_id: str) -> Entry:
    entry = db.get(Entry, entry_id)
    if entry is None or entry.owner_id != owner_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    return entry


@router.get("/{entry_id}", response_model=EntryOut)
def get_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_owned_entry(db, entry_id, current_user.id)


@router.patch("/{entry_id}", response_model=EntryOut)
def update_entry(
    entry_id: str,
    payload: EntryUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = _get_owned_entry(db, entry_id, current_user.id)

    if entry.is_locked:
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Entry is locked (time capsule)")

    content_changed = payload.content is not None and payload.content != entry.content

    if payload.title is not None:
        entry.title = payload.title
    if payload.content is not None:
        entry.content = payload.content
    if payload.entry_date is not None:
        entry.entry_date = payload.entry_date
    if payload.is_favorite is not None:
        entry.is_favorite = payload.is_favorite
    if payload.tags is not None:
        entry.tags = _resolve_tags(db, current_user.id, payload.tags)

    if content_changed:
        entry.ai_status = "pending"

    db.commit()
    db.refresh(entry)

    if content_changed:
        from app.ai.enrichment import run_enrichment

        background_tasks.add_task(run_enrichment, entry.id)

    return entry


@router.post("/{entry_id}/enrich", response_model=EntryOut)
def retry_enrichment(
    entry_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually (re-)trigger AI enrichment, e.g. after fixing an Ollama outage."""
    entry = _get_owned_entry(db, entry_id, current_user.id)
    entry.ai_status = "pending"
    db.commit()
    db.refresh(entry)

    from app.ai.enrichment import run_enrichment

    background_tasks.add_task(run_enrichment, entry.id)
    return entry


@router.post("/{entry_id}/narrate", status_code=status.HTTP_202_ACCEPTED)
def narrate_entry(
    entry_id: str,
    payload: NarrateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Kicks off local text-to-speech narration of an entry (via Piper) as a
    background job. Poll GET /api/media/{media_id} (id returned here) for
    the result -- generation can take a few seconds, longer the first time
    while the voice model downloads.
    """
    entry = _get_owned_entry(db, entry_id, current_user.id)

    text = entry.ai_summary if (payload.use_summary and entry.ai_summary) else entry.content
    if not text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nothing to narrate")

    filename = f"{entry.id}-{datetime.utcnow().timestamp():.0f}.wav"
    relative_path = f"{settings.AUDIO_DIR}/{filename}"

    media = Media(
        owner_id=current_user.id,
        entry_id=entry.id,
        kind="narration",
        file_path=relative_path,
        mime_type="audio/wav",
        status="pending",
    )
    db.add(media)
    db.commit()
    db.refresh(media)

    from app.ai.jobs import run_narration

    background_tasks.add_task(run_narration, media.id, text, payload.voice)

    return {"media_id": media.id, "status": media.status}


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = _get_owned_entry(db, entry_id, current_user.id)
    db.delete(entry)
    db.commit()

    try:
        embeddings.remove_entry(current_user.id, entry_id)
    except Exception:
        pass  # entry row is already gone; a stray vector isn't worth failing the request over

    return None
