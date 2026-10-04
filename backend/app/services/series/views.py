"""The series' own pages of its promises (v1.5): the tapestry by book, and the story so far.

Both read ``SeriesPromises``, every book's promises read once. Reads only.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ...models.story import Story
from ...schemas.promises import BookScene
from ...schemas.series_promises import (
    BookSoFar,
    SeriesBookRef,
    SeriesLane,
    SeriesLinkOut,
    SeriesPromisesOut,
    SoFarCharacter,
    SoFarItem,
    SoFarOpen,
)
from ..findings.fingerprint import normalise
from . import service
from .kinds import SERIES_KINDS, evolving_fields
from .promises import BookAcross, Chain, SeriesPromises

#: A field's value on a card, cut to this: the card is a reminder, not the sheet.
CARD_LIMIT = 200


def _thread_status(sp: SeriesPromises, chain: Chain) -> str:
    rows = [r for _, r in chain.links]
    if any(b.role == "closes" for r in rows for b in r.beats):
        return "resolved"
    if rows and rows[-1].status == "set_aside":
        return "set_aside"
    return "open" if any(r.beats for r in rows) else "planned"


def _twist_status(chain: Chain) -> str:
    rows = [r for _, r in chain.links]
    if any(r.reveal_index is not None for r in rows):
        return "revealed"
    return "planted" if any(c.index is not None for r in rows for c in r.clues) else "planned"


def series_view(sp: SeriesPromises) -> SeriesPromisesOut:
    """Every thread and twist the series shares, a column per book; and its setups across books."""
    lanes = []
    for chain in sp.chains.values():
        first_book, first = chain.links[0]
        lanes.append(
            SeriesLane(
                element_id=chain.element_id,
                kind=chain.kind,
                name=chain.name,
                color_slot=first.color_slot,
                status=_thread_status(sp, chain) if chain.kind == "thread" else _twist_status(chain),
                steps=[BookAcross._step(b, r) for b, r in chain.links],
            )
        )
    lanes.sort(key=lambda lane: (lane.kind != "thread", lane.steps[0].position, lane.name.lower()))

    def scene(story_id: str, node_id: str) -> BookScene:
        book = sp.by_story[story_id]
        return BookScene(position=book.position, story_id=story_id, node_id=node_id, title=book.facts.title(node_id))

    setups = [
        SeriesLinkOut(
            id=link.id,
            link_type=link.link_type,
            note=link.note or "",
            source=scene(link.source_story_id, link.source_node_id),
            target=scene(link.target_story_id, link.target_node_id),
        )
        for link in sp.links
    ]
    setups.sort(key=lambda x: (x.source.position, x.target.position))
    return SeriesPromisesOut(
        books=[SeriesBookRef(position=b.position, story_id=b.story_id, title=b.title) for b in sp.books],
        lanes=lanes,
        setups=setups,
    )


# ── The story so far ─────────────────────────────────────────────────────────────


def _characters(db: Session, sp: SeriesPromises, story_id: str) -> list[SoFarCharacter]:
    """The series' characters in this book, and what changed for each since the book before."""
    series = sp.series
    pos = service.positions(series)
    kind = SERIES_KINDS["character"]
    fields = evolving_fields(kind, series.field_classes)
    out = []
    for element in series.elements:
        if element.kind != "character":
            continue
        mine = service.member_in(element, story_id)
        row = service.member_row(db, mine) if mine else None
        if mine is None or row is None:
            continue
        earlier = [m for m in element.members if pos.get(m.story_id, 1 << 30) < pos[story_id]]
        before = service.member_row(db, max(earlier, key=lambda m: pos[m.story_id])) if earlier else None

        def said(r, f) -> str:
            return str(getattr(r, f) or "").strip()

        if before is None:
            want = said(row, "mission_statement")
            changed = {"mission_statement": want[:CARD_LIMIT]} if want else {}
        else:
            changed = {
                f: said(row, f)[:CARD_LIMIT]
                for f in fields
                if said(row, f) and normalise(said(row, f)) != normalise(said(before, f))
            }
        out.append(
            SoFarCharacter(
                name=element.name, kind="character", ref_id=row.id, changed=changed, first_here=before is None
            )
        )
    return sorted(out, key=lambda c: c.name.lower())


def _open_after(sp: SeriesPromises, position: int) -> list[SoFarOpen]:
    """Threads open and twists planted, not revealed, as the reader leaves book ``position``."""
    out: list[SoFarOpen] = []
    for chain in sp.chains.values():
        upto = [(b, r) for b, r in chain.links if b.position <= position]
        if not upto:
            continue
        book, row = upto[-1]
        if chain.kind == "thread":
            if sp.thread_after(chain, row, position) != "open":
                continue
            began = next(b for b, r in upto if r.beats)
            said = f"since Book {began.position + 1}"
        else:
            if any(r.reveal_index is not None for _, r in upto):
                continue
            clued = [b for b, r in upto if any(c.index is not None for c in r.clues)]
            if not clued:
                continue
            said = f"planted in Book {clued[0].position + 1}"
        out.append(SoFarOpen(kind=chain.kind, name=chain.name, story_id=book.story_id, ref_id=row.id, said=said))
    here = sp.books[position]
    for t in here.threads.values():
        if t.id not in sp.element_of and sp.thread_after(None, t, position) == "open":
            out.append(
                SoFarOpen(kind="thread", name=t.name, story_id=here.story_id, ref_id=t.id, said="this book's own")
            )
    for tw in here.twists.values():
        if tw.id not in sp.element_of and tw.reveal_index is None and any(c.index is not None for c in tw.clues):
            out.append(
                SoFarOpen(kind="twist", name=tw.name, story_id=here.story_id, ref_id=tw.id, said="this book's own")
            )
    return out


def story_so_far(db: Session, sp: SeriesPromises) -> list[BookSoFar]:
    """A card per book, in reading order: what it leaves the reader with (decision 9)."""
    known = sp.known()
    titles = {b.position: b for b in sp.books}
    cards = []
    for book in sp.books:
        story = db.get(Story, book.story_id)
        summary = (story.synopsis or story.paragraph_summary or story.logline or "") if story else ""
        mine = [k for k in known if k.book == book.position]

        def items(kind: str, mine=mine) -> list[SoFarItem]:
            return [
                SoFarItem(
                    text=k.text,
                    source=k.source,
                    story_id=k.story_id,
                    node_id=k.node_id,
                    over=(
                        f"Book {k.over_book + 1} · {k.over_scene}"
                        if k.over_book is not None and k.over_book in titles
                        else None
                    ),
                )
                for k in mine
                if k.kind == kind
            ]

        cards.append(
            BookSoFar(
                position=book.position,
                story_id=book.story_id,
                title=book.title,
                summary=summary.strip(),
                characters=_characters(db, sp, book.story_id),
                learned=items("learned"),
                believes=items("believes"),
                only=items("only"),
                open=_open_after(sp, book.position),
            )
        )
    return cards
