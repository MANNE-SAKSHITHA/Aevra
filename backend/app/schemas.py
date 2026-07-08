"""Pydantic v2 schemas -- the request/response contracts for the API."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# Auth / Users
# ---------------------------------------------------------------------------
class UserCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter")
        return v


class UserLogin(BaseModel):
    full_name: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------
class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str


# ---------------------------------------------------------------------------
# Entries
# ---------------------------------------------------------------------------
class EntryCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    content: str = Field(min_length=1)
    entry_date: datetime | None = None
    tags: list[str] = Field(default_factory=list)
    is_favorite: bool = False


class EntryUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    content: str | None = Field(default=None, min_length=1)
    entry_date: datetime | None = None
    tags: list[str] | None = None
    is_favorite: bool | None = None


class EntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    title: str | None
    content: str
    ai_summary: str | None
    ai_mood: str | None
    ai_emotion: str | None
    ai_status: str
    ai_error: str | None
    entry_date: datetime
    is_favorite: bool
    is_locked: bool
    created_at: datetime
    updated_at: datetime
    tags: list[TagOut] = Field(default_factory=list)


class PaginatedEntries(BaseModel):
    items: list[EntryOut]
    total: int
    page: int
    page_size: int
    pages: int


# ---------------------------------------------------------------------------
# Media
# ---------------------------------------------------------------------------
class MediaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    entry_id: str | None
    kind: str
    file_path: str
    mime_type: str
    size_bytes: int
    duration_seconds: float | None
    transcript: str | None
    status: str
    error_message: str | None
    created_at: datetime


class NarrateRequest(BaseModel):
    voice: str | None = None
    use_summary: bool = Field(
        default=False, description="Narrate the AI summary instead of the raw entry content"
    )


# ---------------------------------------------------------------------------
# Memory Graph
# ---------------------------------------------------------------------------
class GraphNode(BaseModel):
    id: str
    label: str
    type: str  # "entry" | "tag"
    entry_date: datetime | None = None
    mood: str | None = None
    tag_count: int | None = None  # for tag nodes, how many entries reference it


class GraphEdge(BaseModel):
    source: str
    target: str


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


# ---------------------------------------------------------------------------
# Insights / Reflections / Recommendations
# ---------------------------------------------------------------------------
class MoodTrendPoint(BaseModel):
    period: str  # e.g. "2026-06"
    mood_counts: dict[str, int]


class TagFrequency(BaseModel):
    name: str
    count: int


class WritingStreak(BaseModel):
    current_streak_days: int
    longest_streak_days: int
    total_entries: int
    active_days: int


class InsightsResponse(BaseModel):
    mood_trend: list[MoodTrendPoint]
    top_tags: list[TagFrequency]
    streak: WritingStreak
    entries_per_month: list[TagFrequency]  # name = "YYYY-MM", count = entries


class ReflectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    content: str
    based_on_entry_count: int
    created_at: datetime


class Recommendation(BaseModel):
    kind: str  # "reconnect" | "revisit" | "prompt"
    title: str
    detail: str
    entry_id: str | None = None
    tag_name: str | None = None
