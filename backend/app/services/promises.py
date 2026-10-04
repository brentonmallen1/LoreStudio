"""
Promises (doc 18 C2): every promise a story makes, in reading order, from one place.

A thread opens a question and closes it; a twist hides a truth behind what the reader is led
to believe, and its clues point either way; a scene link sets something up for a later scene.
What the reader knows follows from the clues and reveals, plus what the author adds by hand.
The checks read the same view, so the tapestry, the sheets and the findings agree.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..models.plot_thread import PlotThread
from ..models.reader_knowledge import ReaderKnowledgeEvent
from ..models.scene_link import SceneLink
from ..models.structure import StructureNode
from ..models.twist import Twist
from ..schemas.promises import (
    PromiseChapter,
    PromiseCheck,
    PromiseClue,
    PromiseScene,
    PromisesOut,
    PromiseThread,
    PromiseTwist,
    ReaderItem,
    ReaderRow,
    Setup,
    ThreadBeat,
)
from .mice_validation import validate_thread_nesting
from .structure_order import order_of

#: A thread that says nothing for this many scenes in a row, between its first and last, has
#: gone quiet: the reader may have forgotten the question.
QUIET_SCENES = 3

LEARNS = {"truth_revealed", "clue_planted"}


def promises_view(story_id: str, db: Session) -> PromisesOut:
    nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    order = order_of(nodes)
    parents = {n.parent_id for n in nodes if n.parent_id}
    by_id = {n.id: n for n in nodes}
    leaves = sorted((n for n in nodes if n.id not in parents), key=lambda n: order.get(n.id, 0))
    index = {n.id: i for i, n in enumerate(leaves)}

    scenes = [
        PromiseScene(
            id=n.id, title=n.title or "Untitled scene", index=i, chapter_id=n.parent_id, written=(n.word_count or 0) > 0
        )
        for i, n in enumerate(leaves)
    ]
    chapters: list[PromiseChapter] = []
    for s in scenes:
        if s.chapter_id is None:
            continue
        if chapters and chapters[-1].id == s.chapter_id and chapters[-1].first + chapters[-1].count == s.index:
            chapters[-1].count += 1
        else:
            parent = by_id.get(s.chapter_id)
            chapters.append(
                PromiseChapter(id=s.chapter_id, title=(parent.title if parent else "") or "", first=s.index, count=1)
            )

    thread_rows = (
        db.query(PlotThread).filter(PlotThread.story_id == story_id).order_by(PlotThread.created_at.asc()).all()
    )
    threads = []
    for t in thread_rows:
        beats = [
            ThreadBeat(node_id=a.node_id, index=index[a.node_id], role=a.role, note=a.note or "")
            for a in t.appearances
            if a.node_id in index
        ]
        beats.sort(key=lambda b: b.index)
        threads.append(
            PromiseThread(
                id=t.id,
                name=t.name,
                description=t.description or "",
                color_slot=t.color_slot,
                mice_type=t.mice_type,
                status=t.status,
                beats=beats,
            )
        )

    twist_rows = db.query(Twist).filter(Twist.story_id == story_id).order_by(Twist.created_at.asc()).all()
    twists = []
    for tw in twist_rows:
        clues = [
            PromiseClue(
                id=c.id,
                node_id=c.node_id,
                index=index.get(c.node_id or ""),
                text=c.text,
                points_to=c.points_to,
                subtlety=c.subtlety,
                quote=c.quote or "",
            )
            for c in tw.clues
        ]
        clues.sort(key=lambda c: (c.index is None, c.index or 0))
        twists.append(
            PromiseTwist(
                id=tw.id,
                name=tw.name,
                color_slot=tw.color_slot,
                status=tw.status,
                twist_type=tw.twist_type,
                the_truth=tw.the_truth or "",
                the_misdirection=tw.the_misdirection or "",
                reveal_node_id=tw.revealed_at_node_id,
                reveal_index=index.get(tw.revealed_at_node_id or ""),
                clues=clues,
            )
        )

    setups = []
    for link in db.query(SceneLink).filter(SceneLink.story_id == story_id).all():
        a, b = link.source_node_id, link.target_node_id
        if a not in index or b not in index:
            continue
        if index[a] > index[b]:
            a, b = b, a
        setups.append(
            Setup(
                id=link.id,
                link_type=link.link_type,
                from_node_id=a,
                to_node_id=b,
                from_index=index[a],
                to_index=index[b],
                note=link.note or "",
            )
        )
    setups.sort(key=lambda s: (s.from_index, s.to_index))

    events = db.query(ReaderKnowledgeEvent).filter(ReaderKnowledgeEvent.story_id == story_id).all()
    reader = reader_rows(twists, events, index)
    checks = promise_checks(threads, twists, scenes, thread_rows, [n.id for n in leaves])
    return PromisesOut(
        scenes=scenes, chapters=chapters, threads=threads, twists=twists, setups=setups, reader=reader, checks=checks
    )


class _Rows:
    """What the reader knows, gathered by scene."""

    def __init__(self, index: dict[str, int]):
        self.index = index
        self.rows: dict[str, ReaderRow] = {}
        #: Each twist's false beliefs, (scene index, text), for its reveal to overturn.
        self.beliefs: dict[str, list[tuple[int, str]]] = {}

    def at(self, node_id: str) -> ReaderRow:
        if node_id not in self.rows:
            self.rows[node_id] = ReaderRow(node_id=node_id, index=self.index[node_id])
        return self.rows[node_id]

    def overturn(self, node_id: str, text: str, item: ReaderItem) -> None:
        """The reader stops believing `text` here; overturned in the scene that planted it, only
        the struck line shows, and no later reveal overturns it again."""
        row = self.at(node_id)
        row.believes = [i for i in row.believes if i.over or i.text != text]
        row.believes.append(item)
        for twist_id, held in self.beliefs.items():
            self.beliefs[twist_id] = [(at, t) for at, t in held if t != text]

    def believe(self, node_id: str, item: ReaderItem) -> None:
        self.at(node_id).believes.append(item)
        if item.twist_id:
            self.beliefs.setdefault(item.twist_id, []).append((self.index[node_id], item.text))


def reader_rows(twists: list[PromiseTwist], events: list, index: dict[str, int]) -> list[ReaderRow]:
    """What the reader learns, is led to believe and alone knows, scene by scene (doc 18 C8).

    Clues and reveals say most of it; the author's hand entries add what they do not. At a
    twist's reveal, what its misdirection had the reader believe is overturned.
    """
    rows = _Rows(index)
    for tw in twists:
        for c in tw.clues:
            # A clue planted on the words themselves may have no description yet: the words say it.
            text = c.text or (f"“{c.quote}”" if c.quote else "")
            if c.node_id is None or c.index is None or not text:
                continue
            item = ReaderItem(text=text, source="clue", twist_id=tw.id)
            if c.points_to == "truth":
                rows.at(c.node_id).learns.append(item)
            else:
                rows.believe(c.node_id, item)
    _hand_entries(rows, events, index)
    for tw in twists:
        if tw.reveal_node_id is not None and tw.reveal_index is not None:
            _reveal(rows, tw)
    return sorted(rows.rows.values(), key=lambda r: r.index)


def _is_belief(e) -> bool:
    return e.knowledge_type == "misdirection_planted" or (e.knowledge_type in LEARNS and not e.is_truth)


def _hand_entries(rows: _Rows, events: list, index: dict[str, int]) -> None:
    by_event = {e.id: e for e in events}
    for e in sorted(events, key=lambda e: index.get(e.node_id or "", 1 << 30)):
        if e.node_id not in index or not e.reader_knows:
            continue
        item = ReaderItem(text=e.subject, source="you", twist_id=e.twist_id, event_id=e.id)
        if e.knowledge_type == "reader_only":
            rows.at(e.node_id).only.append(item)
        elif _is_belief(e):
            rows.believe(e.node_id, item)
        elif e.knowledge_type in LEARNS:
            rows.at(e.node_id).learns.append(item)
        old = by_event.get(e.supersedes_id or "")
        if old is not None and _is_belief(old):
            rows.overturn(
                e.node_id, old.subject, ReaderItem(text=old.subject, source="you", event_id=old.id, over=True)
            )


def _reveal(rows: _Rows, tw: PromiseTwist) -> None:
    r = rows.at(tw.reveal_node_id or "")
    if tw.the_truth:
        r.learns.append(ReaderItem(text=tw.the_truth, source="reveal", twist_id=tw.id))
    already = {i.text for i in r.believes if i.over}
    for at, text in rows.beliefs.get(tw.id, []):
        if at < (tw.reveal_index or 0) and text not in already:
            r.believes.append(ReaderItem(text=text, source="reveal", twist_id=tw.id, over=True))
            already.add(text)


def promise_checks(
    threads: list[PromiseThread],
    twists: list[PromiseTwist],
    scenes: list[PromiseScene],
    thread_rows: list[PlotThread],
    leaf_ids: list[str],
) -> list[PromiseCheck]:
    """What may need the author's eye. Questions, never verdicts: a deliberate choice stays."""
    title = {s.index: s.title for s in scenes}
    out: list[PromiseCheck] = []

    for t in threads:
        if t.status == "set_aside" or not t.beats:
            continue
        opens = next((b for b in t.beats if b.role == "opens"), None)
        closes = next((b for b in reversed(t.beats) if b.role == "closes"), None)
        if opens and closes and closes.index < opens.index:
            out.append(
                PromiseCheck(
                    check="closes_before_opens",
                    severity="medium",
                    text=f"{t.name} closes in {title[closes.index]}, before it opens in {title[opens.index]}",
                    suggestion="Swap the two, or is one of them a different thread?",
                    thread_id=t.id,
                    node_id=closes.node_id,
                )
            )
        for prev, nxt in zip(t.beats, t.beats[1:], strict=False):
            gap = nxt.index - prev.index - 1
            if gap >= QUIET_SCENES:
                out.append(
                    PromiseCheck(
                        check="quiet_thread",
                        severity="low",
                        text=(
                            f"{t.name} says nothing for {gap} scenes, "
                            f"between {title[prev.index]} and {title[nxt.index]}"
                        ),
                        suggestion="A line or a reminder in one of those scenes keeps the question alive.",
                        thread_id=t.id,
                        node_id=scenes[prev.index + 1].id,
                    )
                )

    reveals: dict[str, list[PromiseTwist]] = {}
    for tw in twists:
        placed = [c for c in tw.clues if c.index is not None]
        if tw.reveal_index is not None:
            reveals.setdefault(tw.reveal_node_id or "", []).append(tw)
            for c in placed:
                if c.index is not None and c.index > tw.reveal_index:
                    out.append(
                        PromiseCheck(
                            check="clue_after_reveal",
                            severity="medium",
                            text=f"A clue for {tw.name} comes in {title[c.index]}, after the reveal",
                            suggestion="After the reveal it is a reminder, not a clue. Move it earlier?",
                            twist_id=tw.id,
                            node_id=c.node_id,
                        )
                    )
            toward = [c for c in placed if c.points_to == "truth" and (c.index or 0) <= tw.reveal_index]
            if not toward:
                out.append(
                    PromiseCheck(
                        check="reveal_without_clue",
                        severity="medium",
                        text=f"{tw.name} is revealed in {title[tw.reveal_index]} with no clue toward the truth before it",
                        suggestion="One clue a careful reader could catch makes the reveal feel earned.",
                        twist_id=tw.id,
                        node_id=tw.reveal_node_id,
                    )
                )
        elif any(c.points_to == "misdirection" for c in placed):
            out.append(
                PromiseCheck(
                    check="misdirection_unanswered",
                    severity="low",
                    text=f"{tw.name} leads the reader astray but is never revealed",
                    suggestion="Where does the reader learn the truth?",
                    twist_id=tw.id,
                )
            )
    for node_id, landing in reveals.items():
        if len(landing) > 1:
            out.append(
                PromiseCheck(
                    check="shared_reveal",
                    severity="low",
                    text=f"{title[landing[0].reveal_index or 0]} reveals {len(landing)} twists at once",
                    suggestion="Deliberate, or would one land harder on its own?",
                    node_id=node_id,
                    twist_id=landing[0].id,
                )
            )

    for v in validate_thread_nesting([t for t in thread_rows if t.status != "set_aside"], leaf_ids):
        out.append(
            PromiseCheck(
                check="crossing_threads",
                severity="low",
                text=v["message"],
                suggestion="Threads usually close in the reverse order they opened. If this crossing is on purpose, leave it.",
                thread_id=v["thread_id"],
            )
        )
    return out
