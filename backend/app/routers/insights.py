from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_user
from app.models import Entry, Reflection, Tag, User
from app.schemas import (
    InsightsResponse,
    MoodTrendPoint,
    Recommendation,
    ReflectionOut,
    TagFrequency,
    WritingStreak,
)

router = APIRouter(prefix="/api", tags=["insights"])


# ---------------------------------------------------------------------------
# Insights
# ---------------------------------------------------------------------------
def _compute_streak(entry_dates: list[date]) -> WritingStreak:
    unique_days = sorted(set(entry_dates))
    if not unique_days:
        return WritingStreak(current_streak_days=0, longest_streak_days=0, total_entries=0, active_days=0)

    longest = 1
    run = 1
    for i in range(1, len(unique_days)):
        if (unique_days[i] - unique_days[i - 1]).days == 1:
            run += 1
        else:
            longest = max(longest, run)
            run = 1
    longest = max(longest, run)

    today = datetime.utcnow().date()
    current = 0
    cursor = today
    day_set = set(unique_days)
    # allow the streak to still count as "current" if today has no entry yet
    if today not in day_set:
        cursor = today - timedelta(days=1)
    while cursor in day_set:
        current += 1
        cursor -= timedelta(days=1)

    return WritingStreak(
        current_streak_days=current,
        longest_streak_days=longest,
        total_entries=len(entry_dates),
        active_days=len(unique_days),
    )


@router.get("/insights", response_model=InsightsResponse)
def get_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entries = db.query(Entry).filter(Entry.owner_id == current_user.id).all()

    mood_by_month: dict[str, Counter] = defaultdict(Counter)
    entries_by_month: Counter = Counter()
    entry_dates: list[date] = []

    for entry in entries:
        month_key = entry.entry_date.strftime("%Y-%m")
        entries_by_month[month_key] += 1
        entry_dates.append(entry.entry_date.date())
        if entry.ai_mood:
            mood_by_month[month_key][entry.ai_mood] += 1

    mood_trend = [
        MoodTrendPoint(period=month, mood_counts=dict(counts))
        for month, counts in sorted(mood_by_month.items())
    ]

    entries_per_month = [
        TagFrequency(name=month, count=count) for month, count in sorted(entries_by_month.items())
    ]

    tag_counter: Counter = Counter()
    for entry in db.query(Entry).options(joinedload(Entry.tags)).filter(
        Entry.owner_id == current_user.id
    ):
        for tag in entry.tags:
            tag_counter[tag.name] += 1
    top_tags = [TagFrequency(name=name, count=count) for name, count in tag_counter.most_common(10)]

    streak = _compute_streak(entry_dates)

    return InsightsResponse(
        mood_trend=mood_trend,
        top_tags=top_tags,
        streak=streak,
        entries_per_month=entries_per_month,
    )


# ---------------------------------------------------------------------------
# Reflections
# ---------------------------------------------------------------------------
@router.get("/reflections", response_model=list[ReflectionOut])
def list_reflections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Reflection)
        .filter(Reflection.owner_id == current_user.id)
        .order_by(Reflection.created_at.desc())
        .all()
    )


@router.post("/reflections/generate", status_code=status.HTTP_202_ACCEPTED)
def generate_reflection(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Kicks off a background job that asks the local Ollama model to notice a
    pattern across your recent entries (mood, recurring topics, etc.) and
    write a short reflection. Requires at least 3 entries to have something
    to work with.
    """
    recent_count = (
        db.query(Entry).filter(Entry.owner_id == current_user.id).count()
    )
    if recent_count < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Write at least a few entries before generating a reflection.",
        )

    from app.ai.reflections import run_reflection_generation

    background_tasks.add_task(run_reflection_generation, current_user.id)
    return {"status": "generating"}


# ---------------------------------------------------------------------------
# Recommendations
# ---------------------------------------------------------------------------
_PROMPT_POOL = [
    "What made you smile today, even briefly?",
    "Describe a conversation that stuck with you this week.",
    "What's something you're looking forward to?",
    "What did you learn about yourself recently?",
    "Who do you want to spend more time with?",
]


@router.get("/recommendations", response_model=list[Recommendation])
def get_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lightweight, non-AI heuristics over existing data -- no model calls, so
    this always works even with Ollama offline:
      - "reconnect": tags used 2+ times but not seen in the last 30 days
      - "revisit": a random older entry you haven't looked at recently
      - "prompt": a rotating journal-prompt suggestion
    """
    recommendations: list[Recommendation] = []
    now = datetime.utcnow()

    entries = (
        db.query(Entry)
        .options(joinedload(Entry.tags))
        .filter(Entry.owner_id == current_user.id)
        .order_by(Entry.entry_date.desc())
        .all()
    )

    tag_last_seen: dict[str, datetime] = {}
    tag_counts: Counter = Counter()
    for entry in entries:
        for tag in entry.tags:
            tag_counts[tag.name] += 1
            if tag.name not in tag_last_seen or entry.entry_date > tag_last_seen[tag.name]:
                tag_last_seen[tag.name] = entry.entry_date

    stale_cutoff = now - timedelta(days=30)
    for name, count in tag_counts.most_common():
        if count >= 2 and tag_last_seen[name] < stale_cutoff and len(recommendations) < 3:
            days_ago = (now - tag_last_seen[name]).days
            recommendations.append(
                Recommendation(
                    kind="reconnect",
                    title=f'Reconnect with "{name}"',
                    detail=f"You haven't written about this in {days_ago} days, but it came up {count} times before.",
                    tag_name=name,
                )
            )

    older_entries = [e for e in entries if (now - e.entry_date).days > 60]
    if older_entries:
        pick = older_entries[len(older_entries) // 2]  # a stable, deterministic "middle" pick
        recommendations.append(
            Recommendation(
                kind="revisit",
                title="Rediscover a forgotten memory",
                detail=pick.title or pick.content[:80],
                entry_id=pick.id,
            )
        )

    prompt_index = hash(current_user.id + now.strftime("%Y-%m-%d")) % len(_PROMPT_POOL)
    recommendations.append(
        Recommendation(
            kind="prompt",
            title="Today's journal prompt",
            detail=_PROMPT_POOL[prompt_index],
        )
    )

    return recommendations
