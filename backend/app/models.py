"""
ORM models for Phase 1 (auth + core journal entries).

Later phases add Media, People, Places, Embeddings, GraphNodes/Edges,
Reflections, TimeCapsules, etc. as separate modules/tables so this file
stays a clean, working foundation rather than a half-finished sprawl.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


entry_tags = Table(
    "entry_tags",
    Base.metadata,
    Column("entry_id", String, ForeignKey("entries.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", String, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    role: Mapped[str] = mapped_column(String, default="user")  # "user" | "admin"

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    entries: Mapped[list["Entry"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("owner_id", "name", name="uq_tag_owner_name"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)

    entries: Mapped[list["Entry"]] = relationship(
        secondary=entry_tags, back_populates="tags"
    )


class Entry(Base):
    """A single journal memory entry (text-first; media attaches in Phase 3)."""

    __tablename__ = "entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)

    title: Mapped[str | None] = mapped_column(String, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # AI-derived fields (nullable -- populated once the AI pipeline lands in
    # Phase 2; entries are fully usable without them in the meantime).
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_mood: Mapped[str | None] = mapped_column(String, nullable=True)
    ai_emotion: Mapped[str | None] = mapped_column(String, nullable=True)
    # "pending" | "completed" | "failed" | "disabled". Lets the UI show a
    # subtle "Aevra is thinking..." state instead of silently missing fields.
    ai_status: Mapped[str] = mapped_column(String, default="pending")
    ai_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    entry_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)  # for future time-capsule support

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    owner: Mapped["User"] = relationship(back_populates="entries")
    tags: Mapped[list["Tag"]] = relationship(secondary=entry_tags, back_populates="entries")
    media: Mapped[list["Media"]] = relationship(back_populates="entry", cascade="all, delete-orphan")


class Media(Base):
    """
    A file attached to (or generated for) an entry: an uploaded photo/video,
    an uploaded voice-journal recording, or Piper-generated narration audio.
    """

    __tablename__ = "media"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    entry_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("entries.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # "image" | "video" | "voice_recording" | "narration"
    kind: Mapped[str] = mapped_column(String, nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)  # relative to STORAGE_ROOT
    mime_type: Mapped[str] = mapped_column(String, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Whisper output, for voice_recording media only. `status`/`error_message`
    # are generic and used for both transcription (voice_recording) and
    # synthesis (narration) background jobs.
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")  # pending|completed|failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    entry: Mapped["Entry | None"] = relationship(back_populates="media")


class Reflection(Base):
    """
    An AI-generated observation about patterns across recent entries, e.g.
    "You feel happiest during travel." Generated on demand rather than on
    a schedule (no task scheduler in this stack yet) via
    POST /api/reflections/generate.
    """

    __tablename__ = "reflections"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    based_on_entry_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
