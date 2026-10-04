"""Proposals from the series (series doc). Local and read-only, like the other sources.

- ``series-in:{element}``: something the series shares is named in this book's prose and
  this book does not have it yet. "Add from the series" brings it in where it last stood.
- ``series-same:{element}:{row}``: this book has its own row with the series element's name.
  "The same one" links them (the book was written before it joined the series).
"""

from __future__ import annotations

import re

from sqlalchemy.orm import Session

from ...models.structure import StructureNode
from ...schemas.proposals import ActResult, Proposal, ProposalAction, ProposalKind
from ..series import service
from ..series.kinds import SERIES_KINDS
from ..text_utils import html_to_text

_KIND: dict[str, ProposalKind] = {"character": "person", "location": "place"}


def _names(row) -> list[str]:
    return [n for n in [row.name, *(getattr(row, "aliases", None) or [])] if n and n.strip()]


def _pattern(names: list[str]) -> re.Pattern | None:
    names = sorted({n.strip() for n in names if len(n.strip()) > 2}, key=len, reverse=True)
    if not names:
        return None
    return re.compile(r"(?<![\w'’])(" + "|".join(re.escape(n) for n in names) + r")(?![\w'’])")


def _snippet(text: str, start: int, end: int) -> str:
    a, b = max(0, start - 60), min(len(text), end + 60)
    return ("…" if a else "") + text[a:b].strip() + ("…" if b < len(text) else "")


def series_proposals(story_id: str, db: Session, titles: dict[str, str]) -> list[Proposal]:
    book = service.membership(db, story_id)
    if book is None:
        return []
    series = book.series
    scenes = None
    out: list[Proposal] = []
    for element in series.elements:
        kind = SERIES_KINDS.get(element.kind)
        if kind is None or service.member_in(element, story_id) is not None:
            continue
        source = service.source_member(series, element, story_id)
        src = service.member_row(db, source) if source else None
        if src is None:
            continue
        pk = _KIND.get(kind.kind, "fact")
        names = _names(src)
        wanted = {n.strip().lower() for n in names}
        # This book's own row of the same name: the same one, written before the series.
        same = next(
            (
                r
                for r in db.query(kind.model).filter(kind.model.story_id == story_id).all()
                if {n.strip().lower() for n in _names(r)} & wanted
                and service.element_for_row(db, kind.table, r.id) is None
            ),
            None,
        )
        if same is not None:
            out.append(
                Proposal(
                    id=f"series-same:{element.id}:{same.id}",
                    kind=pk,
                    source="local",
                    text=f"{same.name} here has the name of {series.name}'s {element.name}",
                    subject=same.name,
                    where=f"{kind.label} in this book",
                    actions=[ProposalAction(id="link", label="The same one", primary=True)],
                    decline="Someone else",
                )
            )
            continue
        pattern = _pattern(names)
        if pattern is None:
            continue
        if scenes is None:
            scenes = [
                (n.id, html_to_text(n.content or ""))
                for n in db.query(StructureNode).filter(StructureNode.story_id == story_id)
                if n.content
            ]
        hits = [(nid, m) for nid, text in scenes if (m := pattern.search(text))]
        if not hits:
            continue
        nid, match = hits[0]
        text = next(t for i, t in scenes if i == nid)
        out.append(
            Proposal(
                id=f"series-in:{element.id}",
                kind=pk,
                source="local",
                text=f"{element.name}, from {series.name}, is named here but is not in this book yet",
                subject=element.name,
                evidence=_snippet(text, match.start(), match.end()),
                node_id=nid,
                where=", ".join(titles.get(i, "") for i, _ in hits[:3]),
                actions=[ProposalAction(id="add", label="Add from the series", primary=True)],
                decline="Not them",
            )
        )
    return out


def act_series(story_id: str, p: Proposal, db: Session, actor: str, client: str | None) -> ActResult:
    source, _, ref = p.id.partition(":")
    element_id, _, row_id = ref.partition(":")
    book = service.membership(db, story_id)
    element = next((e for e in book.series.elements if e.id == element_id), None) if book else None
    if book is None or element is None:
        raise service.SeriesError("That is no longer in the series.", 404)
    kind = SERIES_KINDS[element.kind]
    if source == "series-same":
        service.link_existing(db, book.series, element, story_id, row_id)
        db.commit()
        return ActResult(entity_type=kind.kind, entity_id=row_id)
    row = service.adopt_into_book(db, book.series, element, story_id, actor_id=actor, client_id=client)
    db.commit()
    return ActResult(entity_type=kind.kind, entity_id=row.id)
