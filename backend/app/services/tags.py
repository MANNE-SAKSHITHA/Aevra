from sqlalchemy.orm import Session

from app.models import Tag


def resolve_tags(db: Session, owner_id: str, tag_names: list[str]) -> list[Tag]:
    """Get-or-create Tag rows scoped to the current user."""
    resolved: list[Tag] = []
    for raw_name in tag_names:
        name = raw_name.strip().lower()
        if not name:
            continue
        tag = db.query(Tag).filter(Tag.owner_id == owner_id, Tag.name == name).first()
        if tag is None:
            tag = Tag(owner_id=owner_id, name=name)
            db.add(tag)
            db.flush()  # get an id without committing yet
        resolved.append(tag)
    return resolved
