"""What an import did, kept with the story (doc 28): the original file and where everything went.

Every import through the wizard writes one record. The original upload is kept as a story
asset (attached to the story as its import source) so it can always be downloaded again; the
record's manifest says what each piece became, and the report page reads it back.
"""

from __future__ import annotations

import os
import uuid

from sqlalchemy.orm import Session

from ..models.import_record import ImportedItem, ImportRecord
from ..models.media import AssetAttachment, StoryAsset
from ..models.story import Story
from ..models.structure import StructureNode
from .media_files import write_upload

#: The original file's type, by its extension; a zip may hold anything, so it says so.
_MIME = {
    ".zip": "application/zip",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".rtf": "application/rtf",
    ".md": "text/markdown",
    ".markdown": "text/markdown",
    ".txt": "text/plain",
    ".epub": "application/epub+zip",
    ".fountain": "text/plain",
    ".spmd": "text/plain",
    ".fdx": "application/xml",
}
SOURCE_ROLE = "import-source"


def start(story: Story, *, source: str, filename: str, data: bytes, user_id: str, db: Session) -> ImportRecord:
    """A record for this import, with the original file kept beside the story."""
    asset = StoryAsset(
        id=str(uuid.uuid4()),
        story_id=story.id,
        user_id=user_id,
        original_filename=filename or "import",
        stored_path="",
        mime_type=_MIME.get(os.path.splitext(filename)[1].lower(), "application/octet-stream"),
        size_bytes=len(data),
        description="The file this story was imported from",
    )
    asset.stored_path = write_upload(story.id, asset.id, asset.original_filename, data)
    db.add(asset)
    db.flush()
    db.add(AssetAttachment(asset_id=asset.id, object_type="story", object_id=story.id, role=SOURCE_ROLE))
    record = ImportRecord(story_id=story.id, source=source, filename=filename, asset_id=asset.id, manifest=[])
    db.add(record)
    db.flush()
    return record


def manuscript(record: ImportRecord, story: Story, db: Session) -> None:
    """The manuscript, in the manifest: one line for the whole of it."""
    scenes = db.query(StructureNode).filter(StructureNode.story_id == story.id).count()
    record.manifest = [
        {
            "origin": record.filename,
            "name": "The manuscript",
            "became_type": "manuscript",
            "became_id": story.id,
            "count": scenes,
        },
        *record.manifest,
    ]


def summary(record: ImportRecord, db: Session) -> dict:
    """The record as the report page reads it: what came over by kind, what still waits."""
    came: dict[str, int] = {}
    for row in record.manifest or []:
        kind = str(row.get("became_type") or "")
        if kind in ("imported_item", "left_out", "manuscript"):
            continue
        # "character.appearance": folded into a row made from something else, not a row of its own.
        key = "folded" if "." in kind else kind
        came[key] = came.get(key, 0) + 1
    items = db.query(ImportedItem).filter(ImportedItem.record_id == record.id).all()
    asset = db.get(StoryAsset, record.asset_id) if record.asset_id else None
    manuscript_row = next((r for r in record.manifest or [] if r.get("became_type") == "manuscript"), None)
    return {
        "id": record.id,
        "story_id": record.story_id,
        "source": record.source,
        "filename": record.filename,
        "imported_at": record.imported_at,
        "scenes": (manuscript_row or {}).get("count", 0),
        "came_over": came,
        "waiting": sum(1 for i in items if i.status == "waiting"),
        "placed": sum(1 for i in items if i.status == "placed"),
        "declined": sum(1 for i in items if i.status == "declined"),
        "skipped": [r.get("name") for r in record.manifest or [] if r.get("became_type") == "left_out"],
        "left_out": record.left_out or [],
        "nothing_set": record.nothing_set or [],
        "not_in_file": record.not_in_file or [],
        "original": {"asset_id": asset.id, "filename": asset.original_filename, "size_bytes": asset.size_bytes}
        if asset
        else None,
    }
