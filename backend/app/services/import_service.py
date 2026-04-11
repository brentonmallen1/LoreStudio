"""
Import service — converts external documents into LoreStudio's story structure.

Pipeline:
  1. parse_document()          — pandoc → HTML → list[ParsedParagraph]
  2. detect_structure_heuristic() — heading tags + scene-break markers → list[BreakPosition]
  3. apply_breaks()            — static split at break positions → list of sections
  4. build_preview_tree()      — sections → ImportPreviewTree for frontend
  5. (optional) detect_structure_ai() — AI returns positions only, no content changes
  6. create_story_from_import() — finalized tree → Story + StructureNode rows

CRITICAL: AI never regenerates or rewrites content. It only returns paragraph
indices where breaks should occur. All text comes from the original document.
"""
import asyncio
import logging
import os
import re
import subprocess
import tempfile
import uuid
from html.parser import HTMLParser
from typing import Optional

from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from ..models.story import Story
from ..models.structure import StructureNode
from ..schemas.import_schemas import (
    AIBreakSuggestion,
    BreakPosition,
    FinalizeImportRequest,
    ImportPreviewTree,
    NodeAdjustment,
    ParsedParagraph,
    PreviewNode,
)
from ..schemas.ai_responses import StructuredResult

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Format detection
# ---------------------------------------------------------------------------

MIME_TO_PANDOC = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
    "application/rtf": "rtf",
    "text/rtf": "rtf",
    "application/x-rtf": "rtf",
    "text/markdown": "markdown",
    "text/plain": "markdown",  # pandoc handles plain text as markdown
    "text/x-markdown": "markdown",
}

EXT_TO_PANDOC = {
    ".docx": "docx",
    ".doc": "doc",
    ".rtf": "rtf",
    ".md": "markdown",
    ".markdown": "markdown",
    ".txt": "markdown",
}

CONTENT_TYPE_TO_FORMAT = {
    "docx": "docx",
    "doc": "docx",
    "rtf": "rtf",
    "markdown": "markdown",
    "markdown (txt)": "markdown",
}


def _detect_pandoc_format(filename: str, mime_type: str) -> tuple[str, str]:
    """Return (pandoc_from_format, display_format)."""
    ext = os.path.splitext(filename)[1].lower()
    if ext in EXT_TO_PANDOC:
        pandoc_fmt = EXT_TO_PANDOC[ext]
    elif mime_type in MIME_TO_PANDOC:
        pandoc_fmt = MIME_TO_PANDOC[mime_type]
    else:
        pandoc_fmt = "markdown"

    display = {"docx": "docx", "doc": "docx", "rtf": "rtf", "markdown": "markdown"}.get(pandoc_fmt, "markdown")
    return pandoc_fmt, display


# ---------------------------------------------------------------------------
# Step 1: Parse document via pandoc
# ---------------------------------------------------------------------------

def parse_document(file_bytes: bytes, filename: str, mime_type: str) -> tuple[list[ParsedParagraph], Optional[str], str]:
    """
    Convert an uploaded file to HTML via pandoc, then extract paragraphs.

    Returns: (paragraphs, detected_title, display_format)
    """
    pandoc_fmt, display_format = _detect_pandoc_format(filename, mime_type)

    input_suffix = f".{pandoc_fmt}" if pandoc_fmt != "markdown" else ".md"
    with tempfile.NamedTemporaryFile(suffix=input_suffix, delete=False) as f:
        f.write(file_bytes)
        input_path = f.name

    output_path = input_path + ".html"

    try:
        cmd = [
            "pandoc",
            "--from", pandoc_fmt,
            "--to", "html",
            "--standalone",
            "--output", output_path,
            input_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise RuntimeError(f"pandoc failed: {result.stderr}")

        with open(output_path, "r", encoding="utf-8") as f:
            html_content = f.read()
    finally:
        os.unlink(input_path)
        if os.path.exists(output_path):
            os.unlink(output_path)

    paragraphs, detected_title = _extract_paragraphs(html_content)
    return paragraphs, detected_title, display_format


def _extract_paragraphs(html: str) -> tuple[list[ParsedParagraph], Optional[str]]:
    """Parse pandoc HTML output into a flat list of paragraphs."""
    soup = BeautifulSoup(html, "html.parser")

    # Try to extract document title
    detected_title: Optional[str] = None
    title_tag = soup.find("title")
    if title_tag and title_tag.text.strip() and title_tag.text.strip() not in ("", "Untitled"):
        detected_title = title_tag.text.strip()

    body = soup.find("body") or soup
    paragraphs: list[ParsedParagraph] = []
    index = 0

    for el in body.children:
        tag_name = getattr(el, "name", None)
        if tag_name is None:
            continue  # NavigableString (whitespace)

        if tag_name in ("h1", "h2", "h3", "h4", "h5", "h6", "p", "hr", "blockquote"):
            raw_html = str(el)
            text = el.get_text(separator=" ", strip=True)

            # Extract title from first h1 if none found yet
            if tag_name == "h1" and detected_title is None and text:
                detected_title = text

            word_count = len(text.split()) if text else 0
            preview = text[:120]

            paragraphs.append(ParsedParagraph(
                index=index,
                html=raw_html,
                text_preview=preview,
                tag=tag_name,
                word_count=word_count,
            ))
            index += 1

    return paragraphs, detected_title


# ---------------------------------------------------------------------------
# Step 2: Heuristic structure detection
# ---------------------------------------------------------------------------

# Patterns that indicate a scene break within flowing prose
_SCENE_BREAK_RE = re.compile(
    r"^\s*(\*\s*){2,}\s*\*\s*$"    # * * *
    r"|^\s*(-\s*){2,}\s*-\s*$"      # - - -
    r"|^\s*#{3,}\s*$"               # ###
    r"|^\s*[_—–]{3,}\s*$",          # ___ or — or –
    re.MULTILINE,
)


def detect_structure_heuristic(paragraphs: list[ParsedParagraph]) -> list[BreakPosition]:
    """
    Extract structural break positions from HTML heading tags and scene-break markers.

    Heading levels → hierarchy levels:
      h1 → level 0  (Act / Part / Book)
      h2 → level 1  (Chapter / Section)
      h3+ → level 2  (Scene / Beat)
      <hr> or "* * *" in <p> → level 2 scene break

    Returns breaks sorted by paragraph index.
    """
    breaks: list[BreakPosition] = []

    for para in paragraphs:
        tag = para.tag

        if tag == "h1":
            breaks.append(BreakPosition(
                after_index=para.index - 1,  # break BEFORE this heading
                level=0,
                source="heuristic",
                confidence=1.0,
            ))
        elif tag == "h2":
            breaks.append(BreakPosition(
                after_index=para.index - 1,
                level=1,
                source="heuristic",
                confidence=1.0,
            ))
        elif tag in ("h3", "h4", "h5", "h6"):
            breaks.append(BreakPosition(
                after_index=para.index - 1,
                level=2,
                source="heuristic",
                confidence=0.9,
            ))
        elif tag == "hr":
            breaks.append(BreakPosition(
                after_index=para.index - 1,
                level=2,
                source="heuristic",
                confidence=1.0,
            ))
        elif tag == "p" and _SCENE_BREAK_RE.match(para.text_preview):
            breaks.append(BreakPosition(
                after_index=para.index - 1,
                level=2,
                source="heuristic",
                confidence=0.95,
            ))

    # Remove breaks with invalid negative indices (before the first paragraph)
    breaks = [b for b in breaks if b.after_index >= 0]
    breaks.sort(key=lambda b: b.after_index)
    return breaks


# ---------------------------------------------------------------------------
# Step 3: Apply breaks — split paragraphs into sections
# ---------------------------------------------------------------------------

class _Section:
    """Internal representation of a document section."""
    def __init__(self, level: int, source: str, confidence: float, title_para: Optional[ParsedParagraph] = None):
        self.id = str(uuid.uuid4())
        self.level = level
        self.source = source
        self.confidence = confidence
        self.title_para = title_para       # heading paragraph, if any
        self.content_paras: list[ParsedParagraph] = []
        self.parent_id: Optional[str] = None

    @property
    def title(self) -> str:
        if self.title_para:
            return self.title_para.text_preview
        return ""

    @property
    def word_count(self) -> int:
        return sum(p.word_count for p in self.content_paras)

    @property
    def paragraph_start(self) -> int:
        if self.title_para:
            return self.title_para.index
        if self.content_paras:
            return self.content_paras[0].index
        return 0

    @property
    def paragraph_end(self) -> int:
        if self.content_paras:
            return self.content_paras[-1].index
        if self.title_para:
            return self.title_para.index
        return 0

    @property
    def content_html(self) -> str:
        return "".join(p.html for p in self.content_paras)

    @property
    def content_preview(self) -> str:
        combined = " ".join(p.text_preview for p in self.content_paras[:3])
        return combined[:200]


_HEADING_TAGS = ("h1", "h2", "h3", "h4", "h5", "h6")
_HEADING_LEVEL = {"h1": 0, "h2": 1, "h3": 2, "h4": 2, "h5": 2, "h6": 2}


def apply_breaks(
    paragraphs: list[ParsedParagraph],
    breaks: list[BreakPosition],
    template_levels: list[dict],
) -> list[_Section]:
    """
    Split paragraphs at break positions into a flat list of sections.

    A BreakPosition with after_index=N means "paragraph N+1 begins a new section".
    Heading paragraphs always start a new section regardless of breaks.
    """
    if not paragraphs:
        return []

    # break_after[N] means "start a new section; paragraph N+1 is its first member"
    break_after: dict[int, BreakPosition] = {}
    for b in breaks:
        idx = b.after_index
        if idx not in break_after or b.level < break_after[idx].level:
            break_after[idx] = b

    # Skip scene-break marker paragraphs (pure "* * *" / hr lines)
    skip_indices: set[int] = set()
    for para in paragraphs:
        if para.tag == "hr" or (para.tag == "p" and _SCENE_BREAK_RE.match(para.text_preview)):
            skip_indices.add(para.index)

    sections: list[_Section] = []
    current_section: Optional[_Section] = None

    for para in paragraphs:
        prev_index = para.index - 1
        break_before = break_after.get(prev_index)

        # Determine if a new section should begin at this paragraph
        start_new = break_before is not None or (
            # Heading encountered without an explicit break → implicit new section
            para.tag in _HEADING_TAGS and current_section is None
        ) or (
            para.tag in _HEADING_TAGS and current_section is not None
        )

        if start_new:
            if para.tag in _HEADING_TAGS:
                # Heading becomes the title of the new section
                level = _HEADING_LEVEL.get(para.tag, 2)
                src = break_before.source if break_before else "heuristic"
                conf = break_before.confidence if break_before else 1.0
                current_section = _Section(level, src, conf, title_para=para)
            else:
                # Non-heading after a break (e.g. first para after a scene-break marker)
                brk = break_before  # always present in this branch
                level = brk.level if brk else min(2, len(template_levels) - 1)
                src = brk.source if brk else "heuristic"
                conf = brk.confidence if brk else 0.7
                current_section = _Section(level, src, conf)
                if para.index not in skip_indices:
                    current_section.content_paras.append(para)
            sections.append(current_section)
            continue

        if para.index in skip_indices:
            continue

        if current_section is None:
            current_section = _Section(
                level=min(2, len(template_levels) - 1),
                source="heuristic",
                confidence=0.7,
            )
            sections.append(current_section)

        current_section.content_paras.append(para)

    return sections


# ---------------------------------------------------------------------------
# Step 4: Build preview tree
# ---------------------------------------------------------------------------

def build_preview_tree(
    sections: list[_Section],
    paragraphs: list[ParsedParagraph],
    session_id: str,
    template_id: str,
    template_levels: list[dict],
    source_format: str,
    detected_title: Optional[str],
) -> ImportPreviewTree:
    """
    Convert flat sections into a hierarchical ImportPreviewTree for the frontend.
    Parent-child relationships are determined by level nesting.
    """
    warnings: list[str] = []

    if not sections:
        return ImportPreviewTree(
            session_id=session_id,
            source_format=source_format,
            detected_title=detected_title,
            template_id=template_id,
            template_levels=template_levels,
            nodes=[],
            warnings=["No content detected in document."],
            total_word_count=0,
        )

    def _level_type(level: int) -> str:
        if level < len(template_levels):
            return template_levels[level]["name"].lower()
        return template_levels[-1]["name"].lower()

    # Assign parent_id by walking the section list and tracking the last
    # section seen at each level.
    level_stack: dict[int, str] = {}  # level → id of last section at that level
    nodes: list[PreviewNode] = []

    for sec in sections:
        # Determine parent: the most recent section at a lower level
        parent_id: Optional[str] = None
        for lvl in range(sec.level - 1, -1, -1):
            if lvl in level_stack:
                parent_id = level_stack[lvl]
                break

        level_stack[sec.level] = sec.id
        # Invalidate deeper levels when a shallower break occurs
        for lvl in list(level_stack.keys()):
            if lvl > sec.level:
                del level_stack[lvl]

        # Warn on large unstructured prose blocks
        if sec.word_count > 3000 and sec.source == "heuristic" and sec.confidence < 0.8:
            warnings.append(
                f"Large unstructured block (~{sec.word_count} words). "
                "Consider using 'Get AI Suggestions' to detect scene breaks."
            )

        nodes.append(PreviewNode(
            id=sec.id,
            parent_id=parent_id,
            title=sec.title or f"Untitled {_level_type(sec.level).title()}",
            level=sec.level,
            level_type=_level_type(sec.level),
            content_preview=sec.content_preview,
            word_count=sec.word_count,
            source=sec.source,
            confidence=sec.confidence,
            needs_review=sec.confidence < 0.7 or (not sec.title and sec.word_count > 500),
            paragraph_start=sec.paragraph_start,
            paragraph_end=sec.paragraph_end,
        ))

    total_words = sum(p.word_count for p in paragraphs)
    has_only_one_node = len(nodes) == 1
    if has_only_one_node and total_words > 1000:
        warnings.append("Document has no detectable structure. Use 'Get AI Suggestions' to find scene breaks.")

    return ImportPreviewTree(
        session_id=session_id,
        source_format=source_format,
        detected_title=detected_title,
        template_id=template_id,
        template_levels=template_levels,
        nodes=nodes,
        warnings=list(dict.fromkeys(warnings)),  # deduplicate while preserving order
        total_word_count=total_words,
    )


# ---------------------------------------------------------------------------
# Step 5 (optional): AI structure detection
# ---------------------------------------------------------------------------

def _build_ai_prompt(paragraphs: list[ParsedParagraph], template_levels: list[dict]) -> str:
    level_names = " → ".join(t["name"] for t in template_levels)
    lines = [
        "You are analyzing a document to identify its structure.",
        f"The target structure hierarchy is: {level_names}.",
        "",
        "Below is a numbered list of paragraphs. Each entry shows the paragraph index",
        "and a short preview of its content.",
        "",
        "Your task is to identify where scene breaks, chapter breaks, and part/act breaks occur.",
        "Return ONLY the indices — do NOT rewrite, summarize, or alter any content.",
        "",
        "Paragraphs:",
    ]
    for para in paragraphs:
        tag_label = "" if para.tag == "p" else f"[{para.tag.upper()}] "
        lines.append(f"[{para.index}] {tag_label}{para.text_preview}")

    lines += [
        "",
        "Return a JSON object with this exact schema:",
        '{',
        '  "scene_breaks_after": [<list of int paragraph indices>],',
        '  "chapter_breaks_after": [<list of int paragraph indices>],',
        '  "part_breaks_after": [<list of int paragraph indices>],',
        '  "title_suggestions": {"<paragraph_index>": "<suggested title>"},',
        '  "reasoning": "<brief explanation of key decisions>"',
        '}',
        "",
        "Rules:",
        "- Only include indices where a break actually belongs.",
        "- scene_breaks_after: POV shifts, time jumps, location changes.",
        "- chapter_breaks_after: major narrative turning points.",
        "- part_breaks_after: act-level divisions.",
        "- Do NOT include an index if the paragraph is already a heading tag (shown as [H1], [H2], etc.).",
        "- title_suggestions is optional; only suggest for untitled content sections.",
    ]
    return "\n".join(lines)


async def detect_structure_ai(
    paragraphs: list[ParsedParagraph],
    template_levels: list[dict],
    context,  # AICallContext
    db: Session,
    user,
) -> tuple[Optional[list[BreakPosition]], Optional[str]]:
    """
    Ask the AI to suggest structural break positions.

    Returns (breaks, error_message). breaks is None only when Ollama is unreachable.
    AI only returns indices — all actual content comes from the original paragraphs.
    """
    from .llm.gateway import ai_gateway, AICallContext

    max_paragraphs = 500  # cap for very long documents
    sample = paragraphs[:max_paragraphs]

    feature_prompt = _build_ai_prompt(sample, template_levels)
    messages = [{"role": "user", "content": "Analyze the document structure as instructed."}]

    result: StructuredResult = await ai_gateway.generate_structured(
        response_model=AIBreakSuggestion,
        messages=messages,
        feature_prompt=feature_prompt,
        context=context,
        db=db,
        user=user,
        include_core_prompt=False,  # no character/story context needed
    )

    # Hard failure — Ollama unreachable
    if result.raw_text and result.raw_text.startswith("Error reaching LLM"):
        error_detail = result.raw_text
        logger.warning("AI structure detection failed: %s", error_detail)
        return None, error_detail

    # Use validated data if available; fall back to raw_data if validation failed
    # but JSON parsed successfully (model returned partial response)
    if result.success and result.data:
        data = result.data
    elif result.raw_data and isinstance(result.raw_data, dict):
        logger.info("AI structure detection: using raw_data fallback (schema validation failed)")
        data = result.raw_data
    else:
        logger.warning("AI structure detection: no usable data in response")
        return [], None  # Return empty breaks rather than 503 — Ollama ran but found nothing
    max_idx = len(paragraphs) - 1
    breaks: list[BreakPosition] = []

    for idx in data.get("scene_breaks_after", []):
        if 0 <= idx <= max_idx:
            breaks.append(BreakPosition(after_index=idx, level=2, source="ai", confidence=0.75))

    for idx in data.get("chapter_breaks_after", []):
        if 0 <= idx <= max_idx:
            breaks.append(BreakPosition(after_index=idx, level=1, source="ai", confidence=0.70))

    for idx in data.get("part_breaks_after", []):
        if 0 <= idx <= max_idx:
            breaks.append(BreakPosition(after_index=idx, level=0, source="ai", confidence=0.65))

    breaks.sort(key=lambda b: b.after_index)
    return breaks, None


def _merge_breaks(
    heuristic: list[BreakPosition],
    ai: list[BreakPosition],
) -> list[BreakPosition]:
    """
    Merge heuristic (trusted) and AI (suggestive) breaks.

    Heuristic breaks are kept as-is. AI breaks are added only when they don't
    conflict with an existing heuristic break within ±1 paragraph.
    """
    heuristic_indices = {b.after_index for b in heuristic}
    merged = list(heuristic)

    for ai_break in ai:
        # Skip if heuristic already placed a break nearby
        near_existing = any(abs(ai_break.after_index - h_idx) <= 1 for h_idx in heuristic_indices)
        if not near_existing:
            merged.append(ai_break)

    merged.sort(key=lambda b: b.after_index)
    return merged


# ---------------------------------------------------------------------------
# User adjustments to preview tree
# ---------------------------------------------------------------------------

def apply_adjustment(
    preview: ImportPreviewTree,
    paragraphs: list[ParsedParagraph],
    adjustment: NodeAdjustment,
) -> ImportPreviewTree:
    """Apply a single user edit to the preview tree. Returns updated tree."""
    nodes = list(preview.nodes)

    node_map = {n.id: n for n in nodes}
    target = node_map.get(adjustment.node_id)
    if not target:
        return preview

    if adjustment.action == "rename" and adjustment.new_title:
        idx = next(i for i, n in enumerate(nodes) if n.id == adjustment.node_id)
        nodes[idx] = target.model_copy(update={"title": adjustment.new_title, "source": "user"})

    elif adjustment.action == "relevel" and adjustment.new_level is not None:
        template_levels = preview.template_levels
        new_level = max(0, min(adjustment.new_level, len(template_levels) - 1))

        def _level_type(level: int) -> str:
            if level < len(template_levels):
                return template_levels[level]["name"].lower()
            return template_levels[-1]["name"].lower()

        idx = next(i for i, n in enumerate(nodes) if n.id == adjustment.node_id)
        nodes[idx] = target.model_copy(update={
            "level": new_level,
            "level_type": _level_type(new_level),
            "source": "user",
            "confidence": 1.0,
        })

    elif adjustment.action == "merge_up":
        # Merge this node into its previous sibling (append content)
        target_idx = next(i for i, n in enumerate(nodes) if n.id == adjustment.node_id)
        if target_idx > 0:
            prev = nodes[target_idx - 1]
            merged_preview = (prev.content_preview + " " + target.content_preview)[:200]
            nodes[target_idx - 1] = prev.model_copy(update={
                "word_count": prev.word_count + target.word_count,
                "content_preview": merged_preview,
                "paragraph_end": target.paragraph_end,
                "source": "user",
            })
            nodes.pop(target_idx)

    # Re-assign parent_ids after any structural change
    nodes = _reassign_parents(nodes)

    return preview.model_copy(update={"nodes": nodes})


def _reassign_parents(nodes: list[PreviewNode]) -> list[PreviewNode]:
    """Recompute parent_id for all nodes based on their levels."""
    level_stack: dict[int, str] = {}
    result: list[PreviewNode] = []

    for node in nodes:
        parent_id: Optional[str] = None
        for lvl in range(node.level - 1, -1, -1):
            if lvl in level_stack:
                parent_id = level_stack[lvl]
                break

        level_stack[node.level] = node.id
        for lvl in list(level_stack.keys()):
            if lvl > node.level:
                del level_stack[lvl]

        result.append(node.model_copy(update={"parent_id": parent_id}))

    return result


# ---------------------------------------------------------------------------
# Step 6: Create story from finalized preview
# ---------------------------------------------------------------------------

def create_story_from_import(
    preview: ImportPreviewTree,
    paragraphs: list[ParsedParagraph],
    request: FinalizeImportRequest,
    user_id: str,
    db: Session,
) -> Story:
    """
    Create a new Story with StructureNodes from the finalized import preview.
    Content is assembled from the original paragraphs — never regenerated.
    """
    story = Story(
        id=str(uuid.uuid4()),
        user_id=user_id,
        title=request.title or preview.detected_title or "Imported Story",
        description=request.description,
        structure_template_id=request.template_id,
        genre=request.genre,
    )
    db.add(story)
    db.flush()

    # Build a map of paragraph index → paragraph for fast lookup
    para_map = {p.index: p for p in paragraphs}

    # Node id map for parent resolution
    node_db_ids: dict[str, str] = {}  # preview_node_id → db node_id

    # Track position counters per parent
    position_counters: dict[Optional[str], int] = {}

    for node in preview.nodes:
        parent_db_id: Optional[str] = None
        if node.parent_id and node.parent_id in node_db_ids:
            parent_db_id = node_db_ids[node.parent_id]

        pos_key = parent_db_id
        position = position_counters.get(pos_key, 0)
        position_counters[pos_key] = position + 1

        # Assemble content from original paragraphs in range
        content_html = ""
        if node.paragraph_start <= node.paragraph_end:
            content_parts = []
            for idx in range(node.paragraph_start, node.paragraph_end + 1):
                if idx in para_map:
                    para = para_map[idx]
                    # Skip heading paragraphs (they become the title, not content)
                    if para.tag not in ("h1", "h2", "h3", "h4", "h5", "h6", "hr"):
                        if not _SCENE_BREAK_RE.match(para.text_preview):
                            content_parts.append(para.html)
            content_html = "".join(content_parts)

        # Count words in assembled content
        wc = len(re.sub(r"<[^>]+>", " ", content_html).split())

        db_id = str(uuid.uuid4())
        node_db_ids[node.id] = db_id

        structure_node = StructureNode(
            id=db_id,
            story_id=story.id,
            parent_id=parent_db_id,
            level=node.level,
            level_type=node.level_type,
            title=node.title,
            content=content_html,
            word_count=wc,
            position=position,
            status="draft",
        )
        db.add(structure_node)

    db.commit()
    db.refresh(story)
    return story
