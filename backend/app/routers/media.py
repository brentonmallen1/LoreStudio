import base64
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.media import StoryAsset, AssetAttachment
from ..schemas.media import AssetOut, AssetUpdate, AttachmentCreate, AttachmentOut
from ..auth.dependencies import get_current_user
from ..auth.utils import decode_token
from ..services.llm.ollama import ollama_provider

router = APIRouter()

UPLOADS_DIR = Path("data/uploads")
ALLOWED_MIME_PREFIXES = ("image/", "application/pdf", "text/plain")
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def _get_uploads_dir() -> Path:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    return UPLOADS_DIR


def _verify_story_access(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_asset_access(asset_id: str, db: Session, user: User) -> StoryAsset:
    asset = db.get(StoryAsset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    _verify_story_access(asset.story_id, db, user)
    return asset


# --- Upload ---

@router.post("/stories/{story_id}/media/upload", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
async def upload_asset(
    story_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    story = _verify_story_access(story_id, db, current_user)

    mime = file.content_type or "application/octet-stream"
    if not any(mime.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        raise HTTPException(status_code=415, detail=f"File type '{mime}' not allowed")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit")

    uploads_dir = _get_uploads_dir()
    story_dir = uploads_dir / story_id
    story_dir.mkdir(exist_ok=True)

    asset_id = str(uuid.uuid4())
    safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in (file.filename or "file"))
    stored_path = f"{story_id}/{asset_id}_{safe_name}"
    full_path = uploads_dir / stored_path

    full_path.write_bytes(contents)

    asset = StoryAsset(
        id=asset_id,
        story_id=story.id,
        user_id=current_user.id,
        original_filename=file.filename or "file",
        stored_path=stored_path,
        mime_type=mime,
        size_bytes=len(contents),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


# --- List / Get ---

@router.get("/stories/{story_id}/media", response_model=list[AssetOut])
def list_assets(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story_access(story_id, db, current_user)
    return db.query(StoryAsset).filter(StoryAsset.story_id == story_id).order_by(StoryAsset.created_at.desc()).all()


@router.get("/media/{asset_id}", response_model=AssetOut)
def get_asset(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _verify_asset_access(asset_id, db, current_user)


@router.get("/media/{asset_id}/file")
def serve_asset_file(
    asset_id: str,
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(lambda: None),
):
    """Serve an asset file. Accepts Bearer header or ?token= query param (for use in <img src>)."""
    # Resolve user from query param token if no header-based user
    if token:
        user_id = decode_token(token)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
    else:
        raise HTTPException(status_code=401, detail="Authentication required")
    asset = _verify_asset_access(asset_id, db, user)
    full_path = _get_uploads_dir() / asset.stored_path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(full_path, media_type=asset.mime_type, filename=asset.original_filename)


# --- Update / Delete ---

@router.patch("/media/{asset_id}", response_model=AssetOut)
def update_asset(
    asset_id: str,
    body: AssetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = _verify_asset_access(asset_id, db, current_user)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(asset, key, value)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/media/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = _verify_asset_access(asset_id, db, current_user)
    full_path = _get_uploads_dir() / asset.stored_path
    if full_path.exists():
        full_path.unlink()
    db.delete(asset)
    db.commit()


# --- Attachments ---

@router.get("/media/attachments/{object_type}/{object_id}", response_model=list[AttachmentOut])
def list_attachments(
    object_type: str,
    object_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attachments = (
        db.query(AssetAttachment)
        .filter(AssetAttachment.object_type == object_type, AssetAttachment.object_id == object_id)
        .all()
    )
    # Verify the user has access to at least the first attachment's asset's story
    if attachments:
        _verify_asset_access(attachments[0].asset_id, db, current_user)
    return attachments


@router.post("/media/{asset_id}/attach", response_model=AttachmentOut, status_code=status.HTTP_201_CREATED)
def attach_asset(
    asset_id: str,
    body: AttachmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_asset_access(asset_id, db, current_user)
    # Prevent duplicates
    existing = (
        db.query(AssetAttachment)
        .filter(
            AssetAttachment.asset_id == asset_id,
            AssetAttachment.object_type == body.object_type,
            AssetAttachment.object_id == body.object_id,
        )
        .first()
    )
    if existing:
        existing.role = body.role
        db.commit()
        db.refresh(existing)
        return existing
    attachment = AssetAttachment(asset_id=asset_id, **body.model_dump())
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


@router.delete("/media/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    attachment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attachment = db.get(AssetAttachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    _verify_asset_access(attachment.asset_id, db, current_user)
    db.delete(attachment)
    db.commit()


# --- AI Image Analysis ---

@router.post("/media/{asset_id}/analyze")
async def analyze_image(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream AI analysis of an image: mood, atmosphere, lighting, setting details."""
    asset = _verify_asset_access(asset_id, db, current_user)

    if not asset.mime_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Asset is not an image")

    full_path = _get_uploads_dir() / asset.stored_path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    image_data = base64.b64encode(full_path.read_bytes()).decode()

    system_prompt = (
        "You are a writing assistant helping an author describe settings and atmosphere. "
        "Analyze the provided image and describe: the overall mood and emotional tone, "
        "the atmosphere and lighting quality, dominant colors and their emotional associations, "
        "setting details (time of day, weather, environment), and how these elements could be "
        "woven into a fiction narrative. Be evocative and specific — write like a literary consultant, "
        "not a computer vision model. Keep your response to 3-4 concise paragraphs."
    )
    messages = [
        {
            "role": "user",
            "content": "Please analyze this image for its mood, atmosphere, and setting qualities.",
            "images": [image_data],
        }
    ]

    async def stream():
        try:
            async for token in ollama_provider.chat_stream(messages, system_prompt):
                yield token
        except Exception as e:
            yield f"\n\n[Analysis unavailable: {e}]"

    return StreamingResponse(stream(), media_type="text/plain")
