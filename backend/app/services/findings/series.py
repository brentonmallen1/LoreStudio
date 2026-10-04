"""Series checks (series doc): books that disagree about what should stay true.

One finding per element and enduring field, in every book that says something there, with
the same id in each book (the element, the field and what the books say), so dismissing it
in one dismisses it in all and a new disagreement raises it again. Evolving fields are meant
to differ and are never checked. Nothing here writes; a link whose row is gone is skipped.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ...schemas.findings import Finding, FindingAnchor, FindingFix
from ..series import service
from ..series.drift import disagree
from ..series.kinds import SERIES_KINDS, enduring_fields, field_words
from .fingerprint import normalise
from .make import make
from .view import StoryView

CHECK = "series-canon"


def _quote(text: str, limit: int = 90) -> str:
    text = " ".join(str(text).split())
    return f"“{text[: limit - 1]}…”" if len(text) > limit else f"“{text}”"


def _books(positions: list[int]) -> str:
    names = [str(p + 1) for p in sorted(positions)]
    if len(names) == 1:
        return f"Book {names[0]}"
    return f"Books {', '.join(names[:-1])} and {names[-1]}"


def computed(view: StoryView, db: Session) -> list[Finding]:
    book = service.membership(db, view.story.id)
    if book is None:
        return []
    series = book.series
    pos = service.positions(series)
    out: list[Finding] = []
    for element in series.elements:
        kind = SERIES_KINDS.get(element.kind)
        mine = service.member_in(element, view.story.id)
        if kind is None or mine is None:
            continue
        rows = []
        for m in element.members:
            row = service.member_row(db, m)
            if row is not None and row.story_id == m.story_id and m.story_id in pos:
                rows.append((pos[m.story_id], m.story_id, row))
        here = next((r for p, sid, r in rows if sid == view.story.id), None)
        if here is None or len(rows) < 2:
            continue
        for field in enduring_fields(kind, series.field_classes):
            values = [(p, getattr(r, field) or "") for p, sid, r in rows]
            mine_value = getattr(here, field) or ""
            if not str(mine_value).strip() or not disagree(v for _, v in values):
                continue
            others = [(p, v) for p, v in values if str(v).strip() and normalise(str(v)) != normalise(str(mine_value))]
            words = field_words(field)
            said = sorted({normalise(str(v)) for _, v in values if str(v).strip()})
            finding = make(
                CHECK,
                "continuity",
                "mid",
                "data",
                f"{element.name}'s {words} here differs from {_books([p for p, _ in others])}",
                anchor=FindingAnchor(series_element_id=element.id),
                key=f"{field}#{'|'.join(said)}",
                evidence=" · ".join(f"Book {p + 1}: {_quote(v)}" for p, v in others[:3]),
                suggestion=f"It is meant to stay true across the series. Which {words} is it?",
                where=element.name,
                action="fix",
                fix=FindingFix(kind="series", old="", new=str(mine_value), field=field, element_id=element.id),
            )
            # Shown on this book's sheet; the id above stays the same in every book.
            finding.anchor = FindingAnchor(
                series_element_id=element.id,
                character_id=here.id if kind.kind == "character" else None,
                location_id=here.id if kind.kind == "location" else None,
            )
            out.append(finding)
    return out
