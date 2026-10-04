"""Promises across the books of a series (series doc, v1.5).

A thread or twist that runs across books is a series element with a row in each book that
has it; each book's scenes say what it does there. Nothing here is stored: it is read from
every book's own promises (``promise_facts``), once per request, and handed to each book's
view (``BookAcross``) and to the series' own pages.

- **Each book knows its neighbours.** A thread carried in or on, a twist clued here and
  revealed in another book, what the reader comes in knowing, what the earlier books left
  open. Only earlier books feed what the Assistant is told (``earlier_for_assistant``).
- **Checks across books.** A thread left open with no later book to pick it up, a thread
  that opens again, threads across books that cross rather than nest. Each is raised in the
  book it is about, anchored to the series element when there is one, so one dismissal holds
  in every book.

Reads only. A member whose row is gone is skipped.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any, Literal

from sqlalchemy.orm import Session

from ...models.series import Series, SeriesElementMember
from ...schemas.promises import (
    BookScene,
    BookStep,
    ComingIn,
    ComingInItem,
    EarlierOpen,
    PromiseAcross,
    PromisesOut,
    PromiseThread,
    PromiseTwist,
    SeriesSetup,
)
from ..mice_validation import validate_thread_nesting
from ..promises import LEARNS, PromiseFacts, promise_facts
from ..thread_roles import role_label
from . import service
from .setups import live_links

PromiseKindName = Literal["thread", "twist"]
_TABLES: dict[str, PromiseKindName] = {"plot_threads": "thread", "twists": "twist"}


@dataclass
class Book:
    position: int
    story_id: str
    title: str
    facts: PromiseFacts
    threads: dict[str, PromiseThread]
    twists: dict[str, PromiseTwist]

    @property
    def label(self) -> str:
        return f"Book {self.position + 1}"


@dataclass
class Chain:
    """One thread or twist across the books that have it, in series order."""

    element_id: str
    kind: PromiseKindName
    name: str
    #: (book, its PromiseThread or PromiseTwist), Any: a chain is one kind or the other.
    links: list[tuple[Book, Any]] = field(default_factory=list)

    def link_in(self, position: int):
        return next((row for b, row in self.links if b.position == position), None)

    def before(self, position: int):
        return [(b, row) for b, row in self.links if b.position < position]

    def after(self, position: int):
        return [(b, row) for b, row in self.links if b.position > position]


@dataclass
class Known:
    """One thing the reader comes to know, believe or alone know, in some book."""

    text: str
    kind: Literal["learned", "believes", "only"]
    source: str
    book: int
    index: int
    #: The twist it belongs to: its series element, or ``local:<id>`` for a book's own twist.
    twist_key: str | None = None
    #: A belief overturned: where.
    over_book: int | None = None
    over_scene: str | None = None
    #: The scene it comes from, and that scene's book.
    node_id: str | None = None
    story_id: str = ""


@dataclass
class TwistElsewhere:
    """What the other books do with a twist this book has: what this book's checks need."""

    revealed_in: BookScene | None
    revealed_before: BookScene | None
    truth_clues_before: int


@dataclass
class SeriesCheck:
    """A check across books, raised in one book (``story_id``)."""

    check: str
    story_id: str
    text: str
    suggestion: str
    where: str
    element_id: str | None = None
    #: The thread in the book the check is raised in.
    thread_id: str | None = None
    evidence: str = ""
    #: ``series-left-open``: the book "Bring into Book N" carries it into.
    carry_to: str | None = None
    key: str = ""


# ── Reading the series ───────────────────────────────────────────────────────────


def _is_belief(e) -> bool:
    return e.knowledge_type == "misdirection_planted" or (e.knowledge_type in LEARNS and not e.is_truth)


class SeriesPromises:
    """Every book's promises, read once, and the threads and twists that run between them."""

    def __init__(self, db: Session, series: Series):
        self.series = series
        pos = service.positions(series)
        self.books: list[Book] = []
        for b in sorted(series.books, key=lambda b: pos.get(b.story_id, 0)):
            facts = promise_facts(b.story_id, db)
            self.books.append(
                Book(
                    position=pos[b.story_id],
                    story_id=b.story_id,
                    title=b.story.title,
                    facts=facts,
                    threads={t.id: t for t in facts.threads},
                    twists={t.id: t for t in facts.twists},
                )
            )
        self.by_story = {b.story_id: b for b in self.books}
        self.element_of: dict[str, str] = {}
        self.chains: dict[str, Chain] = {}
        elements = {e.id: e for e in series.elements if e.kind in ("plot_thread", "twist")}
        members = (
            db.query(SeriesElementMember).filter(SeriesElementMember.element_id.in_(list(elements))).all()
            if elements
            else []
        )
        for m in members:
            book = self.by_story.get(m.story_id)
            kind = _TABLES.get(m.ref_table)
            if book is None or kind is None:
                continue
            row = (book.threads if kind == "thread" else book.twists).get(m.ref_id)
            if row is None:
                continue
            element = elements[m.element_id]
            chain = self.chains.setdefault(element.id, Chain(element.id, kind, element.name))
            chain.links.append((book, row))
            self.element_of[m.ref_id] = element.id
        for chain in self.chains.values():
            chain.links.sort(key=lambda br: br[0].position)
        self._known: list[Known] | None = None
        #: Setups that pay off in another book, both scenes still there.
        self.links = live_links(db, series)

    @classmethod
    def for_story(cls, db: Session, story_id: str) -> SeriesPromises | None:
        book = service.membership(db, story_id)
        return cls(db, book.series) if book is not None else None

    def chain_of(self, ref_id: str) -> Chain | None:
        eid = self.element_of.get(ref_id)
        return self.chains.get(eid) if eid else None

    def book(self, story_id: str, facts: PromiseFacts | None = None) -> BookAcross | None:
        here = self.by_story.get(story_id)
        if here is None:
            return None
        if facts is not None:
            here = Book(
                here.position,
                here.story_id,
                here.title,
                facts,
                {t.id: t for t in facts.threads},
                {t.id: t for t in facts.twists},
            )
        return BookAcross(self, here)

    # ── What the reader knows, book after book ──

    def _key(self, twist_id: str | None) -> str | None:
        """A twist as the series knows it: its element, or this book's own twist."""
        if not twist_id:
            return None
        return self.element_of.get(twist_id) or f"local:{twist_id}"

    def known(self) -> list[Known]:
        """Everything the reader learns, believes and alone knows, every book in order, with
        each belief marked where it is overturned (a reveal of its twist, or the author's own
        entry superseding it)."""
        if self._known is None:
            out: list[Known] = []
            for book in self.books:
                self._clues(book, out)
                self._entries(book, out)
                self._reveals(book, out)
            self._known = out
        return self._known

    def _clues(self, book: Book, out: list[Known]) -> None:
        for tw in book.facts.twists:
            for c in tw.clues:
                text = c.text or (f"“{c.quote}”" if c.quote else "")
                if c.index is not None and text:
                    kind = "learned" if c.points_to == "truth" else "believes"
                    out.append(
                        Known(
                            text,
                            kind,
                            "clue",
                            book.position,
                            c.index,
                            self._key(tw.id),
                            node_id=c.node_id,
                            story_id=book.story_id,
                        )
                    )

    def _entries(self, book: Book, out: list[Known]) -> None:
        """The author's own entries in What the reader knows."""
        facts = book.facts
        by_event = {e.id: e for e in facts.events}
        for e in sorted(facts.events, key=lambda e: facts.index.get(e.node_id or "", 1 << 30)):
            at = facts.index.get(e.node_id or "")
            if at is None or not e.reader_knows:
                continue
            kind = (
                "only"
                if e.knowledge_type == "reader_only"
                else "believes"
                if _is_belief(e)
                else "learned"
                if e.knowledge_type in LEARNS
                else None
            )
            if kind is not None:
                out.append(
                    Known(
                        e.subject,
                        kind,
                        "you",
                        book.position,
                        at,
                        self._key(e.twist_id),
                        node_id=e.node_id,
                        story_id=book.story_id,
                    )
                )
            old = by_event.get(e.supersedes_id or "")
            if old is not None and _is_belief(old):
                for k in out:
                    if k.kind == "believes" and k.text == old.subject and k.over_book is None:
                        k.over_book, k.over_scene = book.position, facts.title(e.node_id)

    def _reveals(self, book: Book, out: list[Known]) -> None:
        for tw in book.facts.twists:
            if tw.reveal_index is None:
                continue
            key = self._key(tw.id)
            if tw.the_truth:
                out.append(
                    Known(
                        tw.the_truth,
                        "learned",
                        "reveal",
                        book.position,
                        tw.reveal_index,
                        key,
                        node_id=tw.reveal_node_id,
                        story_id=book.story_id,
                    )
                )
            for k in out:
                if (
                    k.kind == "believes"
                    and k.twist_key == key
                    and k.over_book is None
                    and (k.book, k.index) < (book.position, tw.reveal_index)
                ):
                    k.over_book, k.over_scene = book.position, book.facts.title(tw.reveal_node_id)

    # ── Where a thread stands ──

    @staticmethod
    def _thread_state(row: PromiseThread) -> str:
        if row.status == "set_aside":
            return "done"
        roles = [b.role for b in row.beats]
        if "closes" in roles:
            return "done"
        return "open" if roles else "planned"

    def thread_after(self, chain: Chain | None, row: PromiseThread, position: int) -> str:
        """done | open | planned at the end of book ``position``, the books before it counted."""
        links = [r for b, r in chain.links if b.position <= position] if chain else [row]
        states = [self._thread_state(r) for r in links]
        if "done" in states:
            return "done"
        return "open" if "open" in states else "planned"

    # ── Checks across books ──

    def checks(self) -> list[SeriesCheck]:
        return self._left_open() + self._opens_again() + self._nesting()

    def _left_open(self) -> list[SeriesCheck]:
        out: list[SeriesCheck] = []
        if len(self.books) < 2:
            return out
        for book in self.books[:-1]:
            nxt = self.books[book.position + 1]
            for t in book.threads.values():
                chain = self.chain_of(t.id)
                if self.thread_after(chain, t, book.position) != "open":
                    continue
                if chain is not None and chain.after(book.position):
                    continue
                out.append(
                    SeriesCheck(
                        check="series-left-open",
                        story_id=book.story_id,
                        text=f"{t.name} is still open at the end of this book, and no later book picks it up",
                        suggestion=f"Carry it into {nxt.label}, close it here, or set it aside if the series leaves it.",
                        where=t.name,
                        element_id=chain.element_id if chain else None,
                        thread_id=t.id,
                        evidence=f"{nxt.label}: {nxt.title}",
                        carry_to=nxt.story_id,
                        key=f"left-open:{t.id}",
                    )
                )
        return out

    def _opens_again(self) -> list[SeriesCheck]:
        out: list[SeriesCheck] = []
        for chain in self.chains.values():
            if chain.kind != "thread":
                continue
            for book, row in chain.links:
                opens = next((b for b in row.beats if b.role == "opens"), None)
                earlier = [(b, r) for b, r in chain.before(book.position) if r.beats]
                if opens is None or not earlier:
                    continue
                first_book, first = earlier[0]
                first_open = next((b for b in first.beats if b.role == "opens"), first.beats[0])
                out.append(
                    SeriesCheck(
                        check="series-opens-again",
                        story_id=book.story_id,
                        text=f"{chain.name} opens again in {book.facts.title(opens.node_id)}, "
                        f"but it began in {first_book.label}",
                        suggestion="The reader already holds this question. Is this scene raising it again, "
                        "or is it a new thread?",
                        where=chain.name,
                        element_id=chain.element_id,
                        thread_id=row.id,
                        evidence=f"{first_book.label}: {first_book.facts.title(first_open.node_id)}",
                        key=f"opens-again:{book.story_id}",
                    )
                )
        return out

    def _nesting(self) -> list[SeriesCheck]:
        """Threads that run across books should nest like any others: the one opened later
        closes first. Pairs inside one book are that book's own check."""
        offset, base = {}, 0
        for book in self.books:
            offset[book.story_id] = base
            base += len(book.facts.scenes)
        leaf_order = [f"g{i}" for i in range(base)]
        spans: dict[str, SimpleNamespace] = {}
        crossing: set[str] = set()
        holders: dict[str, list[tuple[Book, str]]] = {}

        def span(key, name, mice, beats_by_book):
            opens = [offset[b.story_id] + x.index for b, beats in beats_by_book for x in beats if x.role == "opens"]
            closes = [offset[b.story_id] + x.index for b, beats in beats_by_book for x in beats if x.role == "closes"]
            if not mice or not opens or not closes:
                return
            spans[key] = SimpleNamespace(
                id=key,
                name=name,
                mice_type=mice,
                opens_at_node_id=f"g{min(opens)}",
                closes_at_node_id=f"g{max(closes)}",
            )

        for chain in self.chains.values():
            if chain.kind != "thread":
                continue
            live = [(b, r) for b, r in chain.links if r.status != "set_aside"]
            span(chain.element_id, chain.name, chain.links[0][1].mice_type, [(b, r.beats) for b, r in live])
            holders[chain.element_id] = [(b, r.id) for b, r in chain.links]
            books_with = {b.position for b, r in live if any(x.role in ("opens", "closes") for x in r.beats)}
            if len(books_with) > 1:
                crossing.add(chain.element_id)
        for book in self.books:
            for t in book.threads.values():
                if t.id in self.element_of or t.status == "set_aside":
                    continue
                span(t.id, t.name, t.mice_type, [(book, t.beats)])
                holders[t.id] = [(book, t.id)]

        out: list[SeriesCheck] = []
        for v in validate_thread_nesting(list(spans.values()), leaf_order):
            inner, outer = v["thread_id"], v["conflicting_thread_id"] or ""
            if inner not in crossing and outer not in crossing:
                continue
            anchor = inner if inner in crossing else outer
            for key in (inner, outer):
                for book, local_id in holders.get(key, []):
                    out.append(
                        SeriesCheck(
                            check="series-nesting",
                            story_id=book.story_id,
                            text=v["message"],
                            suggestion="Across books too, a thread opened later usually closes first. "
                            "If this crossing is on purpose, leave it.",
                            where=v["thread_name"],
                            element_id=anchor,
                            thread_id=local_id,
                            key=f"nesting:{inner}:{outer}",
                        )
                    )
        return out


# ── One book, with the books around it ───────────────────────────────────────────


class BookAcross:
    """What one book's promises view and checks need from the rest of its series."""

    def __init__(self, sp: SeriesPromises, book: Book):
        self.sp = sp
        self.here = book

    def _scene(self, book: Book, node_id: str | None) -> BookScene:
        return BookScene(
            position=book.position, story_id=book.story_id, node_id=node_id, title=book.facts.title(node_id)
        )

    def twist(self, twist_id: str) -> TwistElsewhere | None:
        chain = self.sp.chain_of(twist_id)
        if chain is None:
            return None
        pos = self.here.position
        reveal = next(((b, r) for b, r in chain.links if r.reveal_index is not None), None)
        revealed_in = self._scene(reveal[0], reveal[1].reveal_node_id) if reveal and reveal[0].position != pos else None
        truth_before = sum(
            1 for _, r in chain.before(pos) for c in r.clues if c.points_to == "truth" and c.index is not None
        )
        return TwistElsewhere(
            revealed_in=revealed_in,
            revealed_before=revealed_in if revealed_in and revealed_in.position < pos else None,
            truth_clues_before=truth_before,
        )

    def _coming_in_known(self) -> list[Known]:
        pos = self.here.position
        return [k for k in self.sp.known() if k.book < pos and not (k.over_book is not None and k.over_book < pos)]

    def beliefs_coming_in(self) -> dict[str, list[str]]:
        """This book's twist id -> what earlier books had the reader believe about it, still
        held as the book begins, for this book's reveal to overturn."""
        local = {
            self.sp.element_of[t]: t for t in self.here.twists if t in self.sp.element_of
        }  # element -> this book's twist
        out: dict[str, list[str]] = {}
        for k in self._coming_in_known():
            if k.kind == "believes" and k.twist_key in local:
                out.setdefault(local[k.twist_key], []).append(k.text)
        return out

    def coming_in(self) -> ComingIn | None:
        if self.here.position == 0:
            return None
        local = {self.sp.element_of[t]: t for t in self.here.twists if t in self.sp.element_of}
        out = ComingIn()
        for k in self._coming_in_known():
            item = ComingInItem(
                text=k.text,
                source=k.source,
                book=k.book,
                twist_id=local.get(k.twist_key or ""),
                overturned_at=k.over_scene if k.over_book == self.here.position else None,
            )
            getattr(out, k.kind).append(item)
        return out

    def open_from_earlier(self) -> list[EarlierOpen]:
        pos = self.here.position
        out: list[EarlierOpen] = []
        for chain in self.sp.chains.values():
            earlier = chain.before(pos)
            if not earlier:
                continue
            mine = chain.link_in(pos)
            if chain.kind == "thread":
                if self.sp.thread_after(chain, earlier[-1][1], earlier[-1][0].position) != "open":
                    continue
                moved = [(b, r) for b, r in earlier if r.beats]
                last_book, last = moved[-1]
                out.append(
                    EarlierOpen(
                        kind="thread",
                        element_id=chain.element_id,
                        name=chain.name,
                        ref_id=mine.id if mine else None,
                        opened_book=moved[0][0].position,
                        last_book=last_book.position,
                        last=role_label(last.beats[-1].role),
                    )
                )
            else:
                if any(r.reveal_index is not None for _, r in earlier):
                    continue
                clued = [(b, c) for b, r in earlier for c in r.clues if c.index is not None]
                if not clued:
                    continue
                first = earlier[0][1]
                out.append(
                    EarlierOpen(
                        kind="twist",
                        element_id=chain.element_id,
                        name=chain.name,
                        ref_id=mine.id if mine else None,
                        opened_book=clued[0][0].position,
                        last_book=clued[-1][0].position,
                        last=f"{len(clued)} clue{'s' if len(clued) != 1 else ''}",
                        truth=first.the_truth,
                        clues=[
                            f"{b.label}, {'toward the truth' if c.points_to == 'truth' else 'away from it'}: "
                            f"{c.text or c.quote}"
                            for b, c in clued
                        ],
                    )
                )
        return out

    def across(self) -> dict[str, PromiseAcross]:
        pos = self.here.position
        out: dict[str, PromiseAcross] = {}
        for local_id in [*self.here.threads, *self.here.twists]:
            chain = self.sp.chain_of(local_id)
            if chain is None:
                continue
            steps = [self._step(b, r) for b, r in chain.links]
            entry = PromiseAcross(element_id=chain.element_id, books=steps)
            if chain.kind == "thread":
                row = self.here.threads[local_id]
                moved = [b for b, r in chain.before(pos) if r.beats]
                entry.from_book = moved[0].position if moved else None
                closing = next(((b, r) for b, r in chain.links if any(x.role == "closes" for x in r.beats)), None)
                if closing and closing[0].position != pos:
                    beat = next(x for x in closing[1].beats if x.role == "closes")
                    entry.resolved_in = self._scene(closing[0], beat.node_id)
                later = chain.after(pos)
                if later and self.sp.thread_after(chain, row, pos) != "done":
                    entry.continues_in = later[0][0].position
            else:
                elsewhere = self.twist(local_id)
                entry.revealed_in = elsewhere.revealed_in if elsewhere else None
                clued = [b for b, r in chain.before(pos) if any(c.index is not None for c in r.clues)]
                entry.from_book = clued[0].position if clued else None
                later = chain.after(pos)
                if later and elsewhere and not (elsewhere.revealed_in and elsewhere.revealed_in.position < pos):
                    if self.here.twists[local_id].reveal_index is None:
                        entry.continues_in = later[0][0].position
            out[local_id] = entry
        return out

    @staticmethod
    def _step(book: Book, row: PromiseThread | PromiseTwist) -> BookStep:
        if isinstance(row, PromiseThread):
            return BookStep(
                position=book.position,
                story_id=book.story_id,
                ref_id=row.id,
                roles=[b.role for b in row.beats],
                set_aside=row.status == "set_aside",
                first=book.facts.title(row.beats[0].node_id) if row.beats else "",
                last=book.facts.title(row.beats[-1].node_id) if row.beats else "",
            )
        placed = [c for c in row.clues if c.index is not None]
        return BookStep(
            position=book.position,
            story_id=book.story_id,
            ref_id=row.id,
            toward=sum(1 for c in placed if c.points_to == "truth"),
            away=sum(1 for c in placed if c.points_to != "truth"),
            reveal=book.facts.title(row.reveal_node_id) if row.reveal_index is not None else None,
            first=book.facts.title(placed[0].node_id) if placed else "",
            last=book.facts.title(placed[-1].node_id) if placed else "",
        )

    def setups(self) -> list[SeriesSetup]:
        """Setups across books with an end in this book, each with the other book's scene."""
        out: list[SeriesSetup] = []
        for link in self.sp.links:
            if self.here.story_id not in (link.source_story_id, link.target_story_id):
                continue
            here_is_source = link.source_story_id == self.here.story_id
            node = link.source_node_id if here_is_source else link.target_node_id
            other = self.sp.by_story.get(link.target_story_id if here_is_source else link.source_story_id)
            if other is None or node not in self.here.facts.index:
                continue
            out.append(
                SeriesSetup(
                    id=link.id,
                    link_type=link.link_type,
                    note=link.note or "",
                    direction="out" if here_is_source else "in",
                    node_id=node,
                    index=self.here.facts.index[node],
                    other=self._scene(other, link.target_node_id if here_is_source else link.source_node_id),
                )
            )
        return sorted(out, key=lambda x: x.index)

    def fill(self, out: PromisesOut) -> None:
        out.book = self.here.position
        out.series_id = self.sp.series.id
        out.across = self.across()
        out.coming_in = self.coming_in()
        out.open_from_earlier = self.open_from_earlier()
        out.series_setups = self.setups()

    def checks(self) -> list[SeriesCheck]:
        return [c for c in self.sp.checks() if c.story_id == self.here.story_id]


def across(db: Session, story_id: str, facts: PromiseFacts | None = None) -> BookAcross | None:
    """This book with the rest of its series, or None for a book in none."""
    sp = SeriesPromises.for_story(db, story_id)
    return sp.book(story_id, facts) if sp else None


def earlier_for_assistant(db: Session, story_id: str) -> dict:
    """What the Assistant may know of the books before this one: the threads they left open,
    the twists they planted and have not revealed, and what the reader comes in knowing.
    Never a later book. Empty outside a series or in its first book."""
    ctx = across(db, story_id)
    if ctx is None or ctx.here.position == 0:
        return {}
    still = ctx.open_from_earlier()
    coming = ctx.coming_in() or ComingIn()

    def book(p: int) -> str:
        return f"Book {p + 1}"

    out = {
        "open_threads": [
            {"name": o.name, "since": book(o.opened_book), "last": f"{book(o.last_book)}: {o.last}"}
            for o in still
            if o.kind == "thread"
        ],
        "unrevealed_twists": [
            {"name": o.name, "truth": o.truth, "clues_so_far": o.clues} for o in still if o.kind == "twist"
        ],
        "reader_knows": [f"{book(i.book)}: {i.text}" for i in coming.learned],
        "reader_believes": [f"{book(i.book)}: {i.text}" for i in coming.believes],
        "only_the_reader_knows": [f"{book(i.book)}: {i.text}" for i in coming.only],
    }
    return {k: v for k, v in out.items() if v}


def earlier_lines(db: Session, story_id: str) -> list[str]:
    """The same, as lines for a scene's context: what the books before this one leave open
    and what the reader comes in knowing."""
    told = earlier_for_assistant(db, story_id)
    lines = [f"Still open: {t['name']} (since {t['since']}; last, {t['last']})" for t in told.get("open_threads", [])]
    for tw in told.get("unrevealed_twists", []):
        line = f"Planted, not yet revealed: {tw['name']}"
        if tw["truth"]:
            line += f". The truth: {tw['truth']}"
        lines.append(line)
        lines += [f"  Clue so far, {c}" for c in tw["clues_so_far"]]
    lines += [f"The reader knows ({k})" for k in told.get("reader_knows", [])]
    lines += [f"The reader believes ({k})" for k in told.get("reader_believes", [])]
    lines += [f"Only the reader knows ({k})" for k in told.get("only_the_reader_knows", [])]
    return lines


def render_earlier(lines: list[str] | None) -> list[str]:
    """A prompt section for ``earlier_lines``; nothing outside a series."""
    if not lines:
        return []
    return ["", "## From the earlier books of this series (never the later ones)", *(f"- {x}" for x in lines)]
