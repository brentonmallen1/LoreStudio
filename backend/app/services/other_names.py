"""
The other names a character or place answers to (aliases).

Prose calls things what it calls them: "[[The Keeper's Cottage]]" for Keeper's Cottage,
"@Tom" for Thomas Vance. An alias makes those words resolve without rewriting them. A rename
keeps the old name as an alias while the prose still uses it, so no mention goes dark; once
nothing says it any more the old name is just clutter, and is not kept.
"""

from typing import Literal

from sqlalchemy.orm import Session

from .refactoring_service import preview_entity_rename

Kind = Literal["character", "location"]


def clean(names: list[str], own_name: str) -> list[str]:
    """Trimmed, each once (whatever its case), and never the entry's own name."""
    out: list[str] = []
    seen = {" ".join(own_name.split()).lower()}
    for raw in names:
        name = " ".join(str(raw).split())
        if name and name.lower() not in seen:
            seen.add(name.lower())
            out.append(name)
    return out


def prose_uses(kind: Kind, name: str, story_id: str, db: Session) -> bool:
    """Whether any scene mentions `name` (@Name or <Name> for a character, [[Name]] for a place)."""
    return bool(name.strip()) and bool(preview_entity_rename(kind, name, name, story_id, db))


def settle(entity, data: dict, kind: Kind, db: Session) -> None:
    """
    Before an update is applied: clean any aliases it sets, and on a rename keep the old
    name among them when the prose still mentions it. Changes `data` in place, so the change
    log records the aliases with the name and one Undo puts both back.
    """
    new_name = (data.get("name") or "").strip()
    renamed = bool(new_name) and new_name != entity.name
    if "aliases" not in data and not renamed:
        return
    names = list(data.get("aliases", entity.aliases or []))
    if renamed and prose_uses(kind, entity.name, entity.story_id, db):
        names.append(entity.name)
    data["aliases"] = clean(names, new_name if renamed else entity.name)
