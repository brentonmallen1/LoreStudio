"""
Manuscript & Export endpoints.

GET  /stories/{id}/manuscript  — structured sections for in-app reading
POST /stories/{id}/export       — pandoc / weasyprint file download
"""

import asyncio
import os
import tempfile
from pathlib import Path
from typing import Optional

import weasyprint

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.story import Story
from ..models.user import User
from ..services.manuscript_builder import build_manuscript_html, get_manuscript_sections

router = APIRouter()

ASSETS_DIR = Path(__file__).parent.parent / "assets"

# format key → (pandoc format, mime type, file extension)
EXPORT_FORMATS: dict[str, tuple[str, str, str]] = {
    "docx":            ("docx",     "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
    "docx_manuscript": ("docx",     "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
    "epub":            ("epub",     "application/epub+zip",                                                    "epub"),
    "markdown":        ("markdown", "text/markdown; charset=utf-8",                                            "md"),
    "html":            ("html",     "text/html; charset=utf-8",                                                "html"),
    "odt":             ("odt",      "application/vnd.oasis.opendocument.text",                                 "odt"),
    "pdf":             ("pdf",      "application/pdf",                                                         "pdf"),
}


class ExportOptions(BaseModel):
    format: str
    include_headers: bool = True
    include_scene_titles: bool = False
    title_page: bool = True
    scene_break: str = "* * *"
    status_filter: Optional[list[str]] = None


def _get_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.get("/stories/{story_id}/manuscript")
def get_manuscript(
    story_id: str,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the full ordered section list for in-app manuscript rendering.

    status_filter: comma-separated statuses to include, e.g. "revised,final".
                   Omit to include all scenes.
    """
    story = _get_story(story_id, db, current_user)

    sf = [s.strip() for s in status_filter.split(",")] if status_filter else None
    sections = get_manuscript_sections(story, db, status_filter=sf)

    total_words = sum(s.word_count for s in sections if s.is_leaf)

    return {
        "title": story.title,
        "total_words": total_words,
        "sections": [
            {
                "id": s.id,
                "heading": s.heading,
                "level": s.level,
                "is_leaf": s.is_leaf,
                "content": s.content,
                "word_count": s.word_count,
                "status": s.status,
            }
            for s in sections
        ],
    }


@router.post("/stories/{story_id}/export")
async def export_story(
    story_id: str,
    options: ExportOptions,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Convert the manuscript to the requested format via pandoc and return as a download."""
    if options.format not in EXPORT_FORMATS:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {options.format}")

    story = _get_story(story_id, db, current_user)
    sections = get_manuscript_sections(story, db, status_filter=options.status_filter)

    if not any(s.is_leaf for s in sections):
        raise HTTPException(status_code=422, detail="No scenes to export (check status filter)")

    html_content = build_manuscript_html(
        story,
        sections,
        include_headers=options.include_headers,
        include_scene_titles=options.include_scene_titles,
        title_page=options.title_page,
        scene_break=options.scene_break,
    )

    _, mime_type, ext = EXPORT_FORMATS[options.format]

    safe_title = "".join(
        c if c.isalnum() or c in "- _" else "_"
        for c in (story.title or "manuscript")
    ).strip("_") or "manuscript"
    filename = f"{safe_title}.{ext}"

    # PDF: use weasyprint directly
    if options.format == "pdf":
        try:
            pdf_bytes = weasyprint.HTML(string=html_content).write_pdf()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PDF export failed: {e}")
        return Response(
            content=pdf_bytes,
            media_type=mime_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    # All other formats: pandoc
    pandoc_fmt = EXPORT_FORMATS[options.format][0]

    input_fd, input_path = tempfile.mkstemp(suffix=".html")
    output_fd, output_path = tempfile.mkstemp(suffix=f".{ext}")
    try:
        with os.fdopen(input_fd, "w", encoding="utf-8") as f:
            f.write(html_content)
        os.close(output_fd)

        cmd = [
            "pandoc",
            "--from", "html",
            "--to", pandoc_fmt,
            "--output", output_path,
            "--standalone",
            input_path,
        ]

        if options.format == "docx_manuscript":
            ref_doc = ASSETS_DIR / "manuscript_standard.docx"
            if ref_doc.exists():
                cmd += ["--reference-doc", str(ref_doc)]

        if pandoc_fmt == "epub":
            cmd += [
                f"--metadata=title:{story.title or 'Untitled'}",
                "--metadata=lang:en",
            ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Export failed: {stderr.decode()[:500]}",
            )

        with open(output_path, "rb") as f:
            content = f.read()

        return Response(
            content=content,
            media_type=mime_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    finally:
        if os.path.exists(input_path):
            os.unlink(input_path)
        if os.path.exists(output_path):
            os.unlink(output_path)
