"""
Entity linking service.

Scans scene prose (TipTap HTML) for references to known characters and locations
that are not yet linked with @Name or [[Location]] syntax, and proposes links.

Matching strategy:
  - Exact match: entity name appears verbatim in text
  - Partial match: entity first name appears when full name is multi-word
  - Never re-propose already-linked mentions (@Name or [[Name]])
  - Character: propose @Name link
  - Location/Setting: propose [[Name]] link
"""

import re
import uuid

from .text_utils import html_to_text as _html_to_text

# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------


def _already_linked(text: str, name: str, entity_type: str) -> bool:
    """Return True if `name` is already linked in the plain text."""
    escaped = re.escape(name)
    if entity_type == "character":
        return bool(re.search(rf"@{escaped}\b", text))
    else:
        return bool(re.search(rf"\[\[{re.escape(name)}\]\]", text, re.IGNORECASE))


def _build_proposals(plain: str, characters: list, locations: list) -> list[dict]:
    """Core proposal logic operating on pre-extracted plain text and entity lists."""
    proposals: list[dict] = []

    # Characters → @Name links
    for char in characters:
        full_name = char.name.strip()
        if not full_name:
            continue

        # Collect name variants to check: full name + first name (if multi-word)
        variants = [full_name]
        parts = full_name.split()
        if len(parts) >= 2:
            variants.append(parts[0])  # first name only

        for variant in variants:
            if _already_linked(plain, full_name, "character"):
                break  # full name already linked, skip all variants
            if _already_linked(plain, variant, "character"):
                continue  # this variant already linked

            escaped = re.escape(variant)
            # Find unlinked occurrences: not preceded by @, not inside [[...]]
            for m in re.finditer(rf"(?<!@)\b({escaped})\b(?!\]\])", plain):
                # Skip if inside an existing @mention or [[...]]
                start = m.start()
                excerpt_start = max(0, start - 30)
                excerpt_end = min(len(plain), start + len(variant) + 30)
                excerpt = plain[excerpt_start:excerpt_end]
                if excerpt_start > 0:
                    excerpt = "…" + excerpt
                if excerpt_end < len(plain):
                    excerpt = excerpt + "…"

                confidence = 1.0 if variant == full_name else 0.75

                proposals.append(
                    {
                        "id": str(uuid.uuid4()),
                        "entity_type": "character",
                        "entity_id": char.id,
                        "entity_name": full_name,
                        "matched_text": variant,
                        "text_start": start,
                        "confidence": round(confidence, 2),
                        "source_excerpt": excerpt,
                    }
                )
                break  # one proposal per variant per character

    # Locations → [[Name]] links
    for loc in locations:
        full_name = loc.name.strip()
        if not full_name:
            continue

        if _already_linked(plain, full_name, "location"):
            continue

        escaped = re.escape(full_name)
        for m in re.finditer(rf"(?<!\[\[)\b({escaped})\b(?!\]\])", plain, re.IGNORECASE):
            start = m.start()
            excerpt_start = max(0, start - 30)
            excerpt_end = min(len(plain), start + len(full_name) + 30)
            excerpt = plain[excerpt_start:excerpt_end]
            if excerpt_start > 0:
                excerpt = "…" + excerpt
            if excerpt_end < len(plain):
                excerpt = excerpt + "…"

            proposals.append(
                {
                    "id": str(uuid.uuid4()),
                    "entity_type": "location",
                    "entity_id": loc.id,
                    "entity_name": full_name,
                    "matched_text": m.group(1),
                    "text_start": start,
                    "confidence": 1.0,
                    "source_excerpt": excerpt,
                }
            )
            break  # one proposal per location

    # Sort by position in text
    proposals.sort(key=lambda p: p["text_start"])
    return proposals


def suggest_entity_links_preloaded(
    scene_content: str,
    characters: list,
    locations: list,
) -> list[dict]:
    """Scan scene HTML using pre-loaded entity lists — use in loops to avoid per-scene DB queries."""
    plain = _html_to_text(scene_content)
    return _build_proposals(plain, characters, locations)


def suggest_entity_links(
    scene_content: str,
    story_id: str,
    db,
) -> list[dict]:
    """Scan scene HTML for unlinked character and location name mentions."""
    from ..models.character import Character
    from ..models.location import Location

    characters = db.query(Character).filter(Character.story_id == story_id).all()
    locations = db.query(Location).filter(Location.story_id == story_id).all()
    plain = _html_to_text(scene_content)
    return _build_proposals(plain, characters, locations)


def apply_entity_links(
    scene_content: str,
    links: list[dict],  # list of {matched_text, entity_name, entity_type}
) -> str:
    """
    Apply approved link proposals to raw scene HTML.
    Replaces `matched_text` with @entity_name or [[entity_name]] in the HTML.
    Applied in reverse offset order so earlier positions are not shifted.
    """
    if not links:
        return scene_content

    # Sort by confidence desc, then do simple string replacement in HTML.
    # We operate on the HTML directly — this is safe because entity names
    # won't contain HTML-special characters that would appear encoded.
    content = scene_content

    # Sort longest match first to avoid partial replacement conflicts.
    sorted_links = sorted(links, key=lambda link: len(link["matched_text"]), reverse=True)

    for link in sorted_links:
        matched = link["matched_text"]
        name = link["entity_name"]
        entity_type = link["entity_type"]

        escaped = re.escape(matched)
        if entity_type == "character":
            replacement = f"@{name}"
            # Replace first unlinked occurrence (not already preceded by @)
            content = re.sub(
                rf"(?<!@)\b{escaped}\b",
                replacement,
                content,
                count=1,
            )
        else:
            replacement = f"[[{name}]]"
            content = re.sub(
                rf"(?<!\[\[)\b{escaped}\b(?!\]\])",
                replacement,
                content,
                count=1,
                flags=re.IGNORECASE,
            )

    return content
