from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.compendium import CompendiumAttachment, CompendiumEntry
from ..models.media import StoryAsset
from ..models.story import Story
from ..models.user import User
from ..schemas.compendium import (
    CompendiumAttachBody,
    CompendiumAttachmentOut,
    CompendiumDocumentCreate,
    CompendiumEntryOut,
    CompendiumEntrySummary,
    CompendiumEntryUpdate,
    CompendiumNoteCreate,
    CompendiumUrlCreate,
)
from ..services import change_log
from ..services.series import sync as series_sync
from ..services.text_utils import html_to_text

router = APIRouter()


def _verify_story_access(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_entry_access(entry_id: str, db: Session, user: User) -> CompendiumEntry:
    entry = db.get(CompendiumEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Compendium entry not found")
    story = db.query(Story).filter(Story.id == entry.story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Compendium entry not found")
    return entry


#: How much of an entry the list shows before the author opens it.
PREVIEW_CHARS = 180


def _preview(entry: CompendiumEntry) -> str:
    """The start of what an entry holds: a note's text, a link's description, or its notes."""
    source = entry.content or entry.url_description or entry.notes or ""
    text = " ".join(html_to_text(source).split())
    return text if len(text) <= PREVIEW_CHARS else text[:PREVIEW_CHARS].rsplit(" ", 1)[0] + "…"


def _to_summary(entry: CompendiumEntry) -> dict:
    return {
        "preview": _preview(entry),
        "id": entry.id,
        "story_id": entry.story_id,
        "title": entry.title,
        "entry_type": entry.entry_type,
        "url": entry.url,
        "url_title": entry.url_title,
        "asset_id": entry.asset_id,
        "tags": entry.tags or [],
        "category": entry.category,
        "attachment_count": len(entry.attachments),
        "created_at": entry.created_at,
        "updated_at": entry.updated_at,
    }


async def _fetch_url_metadata(url: str) -> dict:
    """Fetch title and description from a URL. Returns empty dict on failure."""
    try:
        import httpx
        from bs4 import BeautifulSoup

        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
            response = await client.get(url, headers={"User-Agent": "LoreStudio/1.0"})
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            title = None
            if soup.title and soup.title.string:
                title = soup.title.string.strip()
            elif og_title := soup.find("meta", attrs={"property": "og:title"}):
                title = str(og_title.get("content") or "").strip() or None

            description = None
            if meta_desc := soup.find("meta", attrs={"name": "description"}):
                description = str(meta_desc.get("content") or "").strip() or None
            elif og_desc := soup.find("meta", attrs={"property": "og:description"}):
                description = str(og_desc.get("content") or "").strip() or None

            return {"title": title, "description": description}
    except Exception:
        return {}


# ─── Create endpoints ────────────────────────────────────────────────────────


@router.post(
    "/stories/{story_id}/compendium/notes", response_model=CompendiumEntryOut, status_code=status.HTTP_201_CREATED
)
def create_note(
    story_id: str,
    body: CompendiumNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _verify_story_access(story_id, db, current_user)
    entry = CompendiumEntry(
        story_id=story_id,
        entry_type="note",
        title=body.title,
        content=body.content,
        tags=body.tags,
        category=body.category,
        notes=body.notes,
    )
    db.add(entry)
    db.flush()
    change_log.record_row_create(
        db,
        entry,
        "compendium_entries",
        entity_type="compendium_entry",
        story_id=story_id,
        label=f"Add note “{entry.title}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(entry)
    return entry


@router.post(
    "/stories/{story_id}/compendium/urls", response_model=CompendiumEntryOut, status_code=status.HTTP_201_CREATED
)
async def create_url(
    story_id: str,
    body: CompendiumUrlCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _verify_story_access(story_id, db, current_user)

    url_title = None
    url_description = None
    url_fetched_at = None

    if body.fetch_metadata:
        meta = await _fetch_url_metadata(body.url)
        url_title = meta.get("title")
        url_description = meta.get("description")
        url_fetched_at = datetime.now(UTC)

    entry = CompendiumEntry(
        story_id=story_id,
        entry_type="url",
        title=body.title or url_title or body.url,
        url=body.url,
        url_title=url_title,
        url_description=url_description,
        url_fetched_at=url_fetched_at,
        tags=body.tags,
        category=body.category,
        notes=body.notes,
    )
    db.add(entry)
    db.flush()
    change_log.record_row_create(
        db,
        entry,
        "compendium_entries",
        entity_type="compendium_entry",
        story_id=story_id,
        label=f"Add link “{entry.title}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(entry)
    return entry


@router.post(
    "/stories/{story_id}/compendium/documents", response_model=CompendiumEntryOut, status_code=status.HTTP_201_CREATED
)
def create_document(
    story_id: str,
    body: CompendiumDocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _verify_story_access(story_id, db, current_user)
    asset = db.get(StoryAsset, body.asset_id)
    if not asset or asset.story_id != story_id:
        raise HTTPException(status_code=404, detail="Asset not found")
    entry = CompendiumEntry(
        story_id=story_id,
        entry_type="document",
        title=body.title or asset.original_filename,
        asset_id=body.asset_id,
        tags=body.tags,
        category=body.category,
        notes=body.notes,
    )
    db.add(entry)
    db.flush()
    change_log.record_row_create(
        db,
        entry,
        "compendium_entries",
        entity_type="compendium_entry",
        story_id=story_id,
        label=f"Add document “{entry.title}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(entry)
    return entry


# ─── List / Get ───────────────────────────────────────────────────────────────


@router.get("/stories/{story_id}/compendium", response_model=list[CompendiumEntrySummary])
def list_entries(
    story_id: str,
    entry_type: str | None = Query(None),
    category: str | None = Query(None),
    tag: str | None = Query(None),
    q: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    query = db.query(CompendiumEntry).filter(CompendiumEntry.story_id == story_id)
    if entry_type:
        query = query.filter(CompendiumEntry.entry_type == entry_type)
    if category:
        query = query.filter(CompendiumEntry.category == category)
    entries = query.order_by(CompendiumEntry.updated_at.desc()).all()

    # Apply tag + text search in Python (SQLite JSON support varies)
    if tag:
        entries = [e for e in entries if tag in (e.tags or [])]
    if q:
        ql = q.lower()
        entries = [
            e
            for e in entries
            if ql in (e.title or "").lower()
            or ql in (e.content or "").lower()
            or ql in (e.url or "").lower()
            or ql in (e.url_title or "").lower()
            or ql in (e.notes or "").lower()
        ]

    return [_to_summary(e) for e in entries]


@router.get("/compendium/{entry_id}", response_model=CompendiumEntryOut)
def get_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _verify_entry_access(entry_id, db, current_user)


# ─── Update / Delete ──────────────────────────────────────────────────────────


@router.patch("/compendium/{entry_id}", response_model=CompendiumEntryOut)
def update_entry(
    entry_id: str,
    body: CompendiumEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    entry = _verify_entry_access(entry_id, db, current_user)
    data = body.model_dump(exclude_none=True)
    change_log.record_update(
        db,
        entry,
        data,
        entity_type="compendium_entry",
        story_id=entry.story_id,
        label=f"Edit {{fields}} on “{entry.title}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(entry, key, value)
    # Shared with its series: every book's copy follows, each logging its own.
    series_sync.after_write(db, "compendium_entries", entry, list(data), actor_id=current_user.id, client_id=client_id)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/compendium/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    entry = _verify_entry_access(entry_id, db, current_user)
    change_log.record(
        db,
        story_id=entry.story_id,
        entity_type="compendium_entry",
        entity_id=entry.id,
        action="delete",
        before=change_log.capture_compendium_entry(entry, db),
        after=None,
        label=f"Delete “{entry.title}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(entry)
    db.commit()


# ─── URL refresh ─────────────────────────────────────────────────────────────


@router.post("/compendium/{entry_id}/refresh-url", response_model=CompendiumEntryOut)
async def refresh_url(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    entry = _verify_entry_access(entry_id, db, current_user)
    if entry.entry_type != "url" or not entry.url:
        raise HTTPException(status_code=400, detail="Entry is not a URL type")
    meta = await _fetch_url_metadata(entry.url)
    data = {
        "url_title": meta.get("title") or entry.url_title,
        "url_description": meta.get("description") or entry.url_description,
    }
    change_log.record_update(
        db,
        entry,
        data,
        entity_type="compendium_entry",
        story_id=entry.story_id,
        label=f"Refresh link “{entry.title}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(entry, key, value)
    entry.url_fetched_at = datetime.now(UTC)  # bookkeeping, not an edit: left out of the change
    series_sync.after_write(db, "compendium_entries", entry, list(data), actor_id=current_user.id, client_id=client_id)
    db.commit()
    db.refresh(entry)
    return entry


# ─── Attachments ──────────────────────────────────────────────────────────────


@router.post(
    "/compendium/{entry_id}/attach", response_model=CompendiumAttachmentOut, status_code=status.HTTP_201_CREATED
)
def attach_entry(
    entry_id: str,
    body: CompendiumAttachBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    entry = _verify_entry_access(entry_id, db, current_user)
    # Prevent duplicate attachments
    existing = (
        db.query(CompendiumAttachment)
        .filter(
            CompendiumAttachment.entry_id == entry_id,
            CompendiumAttachment.object_type == body.object_type,
            CompendiumAttachment.object_id == body.object_id,
        )
        .first()
    )
    if existing:
        return existing
    attachment = CompendiumAttachment(
        entry_id=entry_id,
        object_type=body.object_type,
        object_id=body.object_id,
        note=body.note,
    )
    db.add(attachment)
    db.flush()
    change_log.record_row_create(
        db,
        attachment,
        "compendium_attachments",
        entity_type="compendium_attachment",
        story_id=entry.story_id,
        label=f"Attach “{entry.title}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(attachment)
    return attachment


@router.get("/compendium/attachments/{object_type}/{object_id}", response_model=list[CompendiumAttachmentOut])
def list_attachments_for_object(
    object_type: str,
    object_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attachments = (
        db.query(CompendiumAttachment)
        .filter(
            CompendiumAttachment.object_type == object_type,
            CompendiumAttachment.object_id == object_id,
        )
        .all()
    )
    # Filter to entries owned by current user
    result = []
    for att in attachments:
        entry = db.get(CompendiumEntry, att.entry_id)
        if entry:
            story = db.query(Story).filter(Story.id == entry.story_id, Story.user_id == current_user.id).first()
            if story:
                result.append(att)
    return result


@router.delete("/compendium/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    attachment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    attachment = db.get(CompendiumAttachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    entry = _verify_entry_access(attachment.entry_id, db, current_user)
    change_log.record_row_delete(
        db,
        attachment,
        "compendium_attachments",
        entity_type="compendium_attachment",
        story_id=entry.story_id,
        label=f"Detach “{entry.title}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(attachment)
    db.commit()
