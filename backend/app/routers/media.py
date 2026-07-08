import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Media, User
from app.schemas import MediaOut

router = APIRouter(prefix="/api/media", tags=["media"])
settings = get_settings()

_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm"}
_AUDIO_TYPES = {"audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "audio/m4a"}


def _kind_for_mime(mime_type: str) -> str:
    if mime_type in _IMAGE_TYPES:
        return "image"
    if mime_type in _VIDEO_TYPES:
        return "video"
    if mime_type in _AUDIO_TYPES:
        return "voice_recording"
    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail=f"Unsupported file type: {mime_type}",
    )


def _save_upload(file: UploadFile, subdir: str) -> tuple[Path, int]:
    ext = Path(file.filename or "").suffix
    filename = f"{uuid.uuid4()}{ext}"
    dest_dir = Path(settings.STORAGE_ROOT) / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / filename

    size = 0
    with open(dest_path, "wb") as out:
        while chunk := file.file.read(1024 * 1024):
            size += len(chunk)
            out.write(chunk)

    return dest_path, size


@router.post("/upload", response_model=MediaOut, status_code=status.HTTP_201_CREATED)
def upload_media(
    file: UploadFile,
    entry_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a photo or video, optionally attached to an existing entry."""
    mime_type = file.content_type or "application/octet-stream"
    kind = _kind_for_mime(mime_type)
    if kind == "voice_recording":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use /api/media/voice-journal for audio recordings.",
        )

    subdir = settings.MEDIA_DIR if kind == "video" else settings.UPLOADS_DIR
    dest_path, size = _save_upload(file, subdir)

    media = Media(
        owner_id=current_user.id,
        entry_id=entry_id,
        kind=kind,
        file_path=str(dest_path.relative_to(settings.STORAGE_ROOT)),
        mime_type=mime_type,
        size_bytes=size,
        status="completed",
    )
    db.add(media)
    db.commit()
    db.refresh(media)
    return media


@router.post("/voice-journal", response_model=MediaOut, status_code=status.HTTP_201_CREATED)
def upload_voice_journal(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a voice recording to be transcribed by Whisper. Transcription
    runs in the background; poll GET /api/media/{id} for the result, or
    build an entry from it once `status` is "completed" via
    POST /api/media/{id}/create-entry.
    """
    mime_type = file.content_type or "application/octet-stream"
    if mime_type not in _AUDIO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported audio type: {mime_type}",
        )

    dest_path, size = _save_upload(file, settings.AUDIO_DIR)

    media = Media(
        owner_id=current_user.id,
        kind="voice_recording",
        file_path=str(dest_path.relative_to(settings.STORAGE_ROOT)),
        mime_type=mime_type,
        size_bytes=size,
        status="pending",
    )
    db.add(media)
    db.commit()
    db.refresh(media)

    from app.ai.jobs import run_transcription

    background_tasks.add_task(run_transcription, media.id)
    return media


@router.get("", response_model=list[MediaOut])
def list_media(
    entry_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Media).filter(Media.owner_id == current_user.id)
    if entry_id:
        query = query.filter(Media.entry_id == entry_id)
    return query.order_by(Media.created_at.desc()).all()


def _get_owned_media(db: Session, media_id: str, owner_id: str) -> Media:
    media = db.get(Media, media_id)
    if media is None or media.owner_id != owner_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")
    return media


@router.get("/{media_id}", response_model=MediaOut)
def get_media(
    media_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_owned_media(db, media_id, current_user.id)


@router.post("/{media_id}/create-entry", status_code=status.HTTP_201_CREATED)
def create_entry_from_voice_journal(
    media_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Turns a completed voice-journal transcript into a real journal entry."""
    media = _get_owned_media(db, media_id, current_user.id)
    if media.kind != "voice_recording":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not a voice recording")
    if media.status != "completed" or not media.transcript:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Transcript not ready yet (status: {media.status})",
        )

    from app.models import Entry

    entry = Entry(owner_id=current_user.id, content=media.transcript, ai_status="pending")
    db.add(entry)
    db.commit()
    db.refresh(entry)

    media.entry_id = entry.id
    db.commit()

    from app.ai.enrichment import run_enrichment

    background_tasks.add_task(run_enrichment, entry.id)

    return {"entry_id": entry.id}


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(
    media_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    media = _get_owned_media(db, media_id, current_user.id)
    file_path = Path(settings.STORAGE_ROOT) / media.file_path
    db.delete(media)
    db.commit()
    if file_path.exists():
        file_path.unlink()
    return None
