import base64
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel as PydanticBase
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..auth.utils import decode_token
from ..config import settings
from ..database import get_db
from ..models.media import AssetAttachment, StoryAsset
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.media import AssetOut, AssetUpdate, AttachmentCreate, AttachmentOut
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.character_from_image import CHARACTER_FROM_IMAGE_SYSTEM, CHARACTER_FROM_IMAGE_USER
from ..services.llm.prompts.scene_atmosphere import SCENE_ATMOSPHERE_SYSTEM, build_scene_atmosphere_prompt
from ..services.llm.sse import sse_stream

router = APIRouter()

UPLOADS_DIR = Path(settings.uploads_path)
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


async def _read_upload(file: UploadFile) -> tuple[bytes, str]:
    """The file's bytes and type, refused when the type or size is not allowed."""
    mime = file.content_type or "application/octet-stream"
    if not any(mime.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        raise HTTPException(status_code=415, detail=f"File type '{mime}' not allowed")
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit")
    return contents, mime


def _write_upload(story_id: str, asset_id: str, filename: str | None, contents: bytes) -> str:
    """Write the bytes under the story's folder; returns the stored path."""
    story_dir = _get_uploads_dir() / story_id
    story_dir.mkdir(exist_ok=True)
    safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in (filename or "file"))
    # A short random part keeps a replacement from landing on the file it replaces.
    stored_path = f"{story_id}/{asset_id}_{uuid.uuid4().hex[:8]}_{safe_name}"
    (_get_uploads_dir() / stored_path).write_bytes(contents)
    return stored_path


@router.post("/stories/{story_id}/media/upload", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
async def upload_asset(
    story_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    story = _verify_story_access(story_id, db, current_user)
    contents, mime = await _read_upload(file)
    asset_id = str(uuid.uuid4())
    asset = StoryAsset(
        id=asset_id,
        story_id=story.id,
        user_id=current_user.id,
        original_filename=file.filename or "file",
        stored_path=_write_upload(story_id, asset_id, file.filename, contents),
        mime_type=mime,
        size_bytes=len(contents),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.put("/media/{asset_id}/file", response_model=AssetOut)
async def replace_asset_file(
    asset_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """A new file for the same image (doc 14 Q5): its caption, note and every place that uses
    it stay, so a scene, sheet or diagram shows the new picture without being touched."""
    asset = _verify_asset_access(asset_id, db, current_user)
    contents, mime = await _read_upload(file)
    old_path = _get_uploads_dir() / asset.stored_path
    asset.stored_path = _write_upload(asset.story_id, asset.id, file.filename, contents)
    asset.original_filename = file.filename or asset.original_filename
    asset.mime_type = mime
    asset.size_bytes = len(contents)
    db.commit()
    db.refresh(asset)
    if old_path.exists() and old_path != _get_uploads_dir() / asset.stored_path:
        old_path.unlink()
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
    # no-cache: the browser asks again each time, so a replaced file shows (a 304 when unchanged).
    return FileResponse(
        full_path,
        media_type=asset.mime_type,
        filename=asset.original_filename,
        headers={"Cache-Control": "no-cache"},
    )


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

    feature_prompt = (
        "You are a writing assistant helping an author describe settings and atmosphere. "
        "Analyze the provided image and describe: the overall mood and emotional tone, "
        "the atmosphere and lighting quality, dominant colors and their emotional associations, "
        "setting details (time of day, weather, environment), and how these elements could be "
        "woven into a fiction narrative. Be evocative and specific — write like a literary consultant, "
        "not a computer vision model. Keep your response to 3-4 concise paragraphs."
    )
    llm_messages = [
        {
            "role": "user",
            "content": "Please analyze this image for its mood, atmosphere, and setting qualities.",
            "images": [image_data],
        }
    ]

    ctx = AICallContext(
        feature="image-analysis",
        user_id=current_user.id,
        story_id=asset.story_id,
        tags=["compendium", "analysis", "user-initiated"],
        extra_metadata={"asset_id": asset_id},
    )

    return sse_stream(
        ai_gateway,
        messages=llm_messages,
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


@router.post("/media/{asset_id}/analyze/character")
async def analyze_image_for_character(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream AI character profile suggestions derived from a portrait image."""
    asset = _verify_asset_access(asset_id, db, current_user)

    if not asset.mime_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Asset is not an image")

    full_path = _get_uploads_dir() / asset.stored_path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    image_data = base64.b64encode(full_path.read_bytes()).decode()

    llm_messages = [
        {
            "role": "user",
            "content": CHARACTER_FROM_IMAGE_USER,
            "images": [image_data],
        }
    ]

    ctx = AICallContext(
        feature="character-from-image",
        user_id=current_user.id,
        story_id=asset.story_id,
        tags=["lorebook", "character", "ai-assist", "user-initiated"],
        extra_metadata={"asset_id": asset_id},
    )

    return sse_stream(
        ai_gateway,
        messages=llm_messages,
        feature_prompt=CHARACTER_FROM_IMAGE_SYSTEM,
        context=ctx,
        db=db,
        user=current_user,
    )


# --- Scene Atmosphere Analysis ---


class SceneAtmosphereRequest(PydanticBase):
    asset_ids: list[str]
    node_id: str | None = None
    user_query: str | None = None


@router.post("/stories/{story_id}/analyze/scene-atmosphere")
async def analyze_scene_atmosphere(
    story_id: str,
    body: SceneAtmosphereRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream an AI atmospheric description synthesized from reference images."""
    story = _verify_story_access(story_id, db, current_user)

    if not body.asset_ids:
        raise HTTPException(status_code=400, detail="At least one asset_id required")

    # Load scene context if a node was provided
    scene_title: str | None = None
    scene_synopsis: str | None = None
    if body.node_id:
        node = db.get(StructureNode, body.node_id)
        if node and node.story_id == story.id:
            scene_title = node.title
            scene_synopsis = node.synopsis or None

    # Encode all requested images (skip missing / non-image assets)
    image_payloads: list[str] = []
    for asset_id in body.asset_ids[:5]:  # max 5 images
        asset = db.get(StoryAsset, asset_id)
        if not asset or asset.story_id != story.id:
            continue
        if not asset.mime_type.startswith("image/"):
            continue
        full_path = _get_uploads_dir() / asset.stored_path
        if not full_path.exists():
            continue
        image_payloads.append(base64.b64encode(full_path.read_bytes()).decode())

    if not image_payloads:
        raise HTTPException(status_code=400, detail="No valid image assets found")

    user_prompt = build_scene_atmosphere_prompt(
        num_images=len(image_payloads),
        user_query=body.user_query,
        scene_title=scene_title,
        scene_synopsis=scene_synopsis,
    )

    llm_messages = [
        {
            "role": "user",
            "content": user_prompt,
            "images": image_payloads,
        }
    ]

    ctx = AICallContext(
        feature="scene-atmosphere",
        user_id=current_user.id,
        story_id=story_id,
        tags=["manuscript", "atmosphere", "ai-assist", "user-initiated"],
        extra_metadata={"asset_ids": body.asset_ids, "node_id": body.node_id},
    )

    return sse_stream(
        ai_gateway,
        messages=llm_messages,
        feature_prompt=SCENE_ATMOSPHERE_SYSTEM,
        context=ctx,
        db=db,
        user=current_user,
    )
