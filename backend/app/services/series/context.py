"""What the Assistant may know of an element from the books before this one (series doc).

Only earlier books: a later book is the author's plan for what has not happened yet, and
the Assistant working on this book must not know it. Only what changes from book to book
and was said there; what stays true is already on this book's own row. Reads only.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from .kinds import SERIES_KINDS, evolving_fields, field_words
from .service import element_for_row, member_row, positions

#: Each earlier value, cut to this, so a long arc does not crowd out the scene.
VALUE_LIMIT = 240


def earlier_states(db: Session, table: str, ref_id: str) -> list[dict]:
    """``[{"book": "Book 1: The Last Lighthouse", "fields": {"personality": "…"}}]``, oldest first."""
    element = element_for_row(db, table, ref_id)
    if element is None:
        return []
    kind = SERIES_KINDS.get(element.kind)
    pos = positions(element.series)
    mine = next((m for m in element.members if m.ref_id == ref_id), None)
    if kind is None or mine is None or mine.story_id not in pos:
        return []
    out = []
    fields = evolving_fields(kind, element.series.field_classes)
    titles = {b.story_id: b.story.title for b in element.series.books}
    for m in sorted(element.members, key=lambda m: pos.get(m.story_id, 0)):
        if m.story_id not in pos or pos[m.story_id] >= pos[mine.story_id]:
            continue
        row = member_row(db, m)
        if row is None:
            continue
        said = {
            field_words(f): str(getattr(row, f))[:VALUE_LIMIT] for f in fields if str(getattr(row, f) or "").strip()
        }
        if said:
            out.append({"book": f"Book {pos[m.story_id] + 1}: {titles.get(m.story_id, '')}", "fields": said})
    return out


def earlier_text(db: Session, table: str, ref_id: str) -> str:
    """The same, as lines for a prompt; empty when there is nothing earlier."""
    lines = []
    for state in earlier_states(db, table, ref_id):
        lines.append(f"{state['book']}:")
        lines += [f"- {k}: {v}" for k, v in state["fields"].items()]
    return "\n".join(lines)
