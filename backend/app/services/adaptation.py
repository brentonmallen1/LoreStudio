"""
Adapting a novel as a script (doc 25, P10): a new screenplay or stage play, told from the novel.

Nothing the author wrote is converted. The script is a new story in the novel's series (made
now if there is none), placed right after the novel, sharing the Lorebook the author chose to
carry over, so a character changed in one is changed in both. It starts with the novel's
outline: every act, chapter and scene, their titles, synopses and plans, each scene with the
places it is set in, the threads it moves and the twists it plants or reveals, and its text
empty but for the heading the place gives it ("INT. KEEPER'S COTTAGE"; in a play, "SCENE 2").
Each scene remembers the novel's scene it tells, so the novel's prose can be read beside it.
The title page says what it is based on.

The script is a whole new story, so the change log (which lives inside a story) cannot undo
its making; deleting it does, and a snapshot covers the novel.
"""

from __future__ import annotations

import re
import uuid

from sqlalchemy.orm import Session

from ..models.location import Location, SceneSetting
from ..models.plot_thread import PlotThreadAppearance
from ..models.series import Series
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.twist import Twist, TwistClue
from . import word_count
from .script_scene import derive_heading
from .script_syntax import Slug, format_slugline
from .series import service
from .series.kinds import SERIES_KINDS, name_of
from .story_format import SCRIPT_FORMATS, is_script

#: What the new script is called, to begin with.
TITLES = {"screenplay": "{title}: The Screenplay", "stage_play": "{title}: A Play"}
#: What it is, said in the series' list of books (the book's role, in the author's words later).
ROLES = {"screenplay": "“{title}” told as a screenplay.", "stage_play": "“{title}” told for the stage."}

#: The plan of a part of the story, which an adaptation keeps as it is.
_PLAN = ("title", "synopsis", "purpose", "entry_state", "exit_state", "key_events", "in_world_date")
_PLAN += ("timeline_position", "level", "level_type", "position")

#: Words in a place's name or kind that put a scene outside: EXT. Anywhere else is INT.
_OUTSIDE = re.compile(
    r"\b(street|road|lane|path|beach|coast|shore|cliffs?|sea|ocean|forest|woods?|field|garden|yard|island|"
    r"mountains?|hills?|river|lake|harbou?r|quay|dock|pier|park|desert|town|city|village|region|country|"
    r"landscape|wilderness|outdoors?|outside|square|bridge|moor|valley|meadow|camp)\b",
    re.I,
)
_NUMBERS = ("One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten")


class AdaptError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def adapt_candidates(db: Session, story: Story) -> list[dict]:
    """The novel's Lorebook, everything ticked: the script tells the same story, so it starts
    with the whole cast, every place and thread, closed or not. Same shape as a sequel's."""
    out: list[dict] = []
    for kind in SERIES_KINDS.values():
        if kind.synced:
            continue
        name_col = getattr(kind.model, kind.name_attr)
        for row in db.query(kind.model).filter(kind.model.story_id == story.id).order_by(name_col).all():
            if getattr(row, "is_stub", False):
                continue
            element = service.element_for_row(db, kind.table, row.id)
            out.append(
                {
                    "kind": kind.kind,
                    "ref_id": row.id,
                    "element_id": element.id if element else None,
                    "name": name_of(row, kind),
                    "in_series": element is not None,
                    "parent_ref_id": getattr(row, "parent_id", None),
                    "preselect": True,
                }
            )
    return out


def based_on(novel: Story) -> str:
    """The title page's credit line: 'Based on the novel “The Last Lighthouse” by A. Writer'."""
    by = f" by {novel.author_name.strip()}" if novel.author_name.strip() else ""
    return f"Based on the novel “{novel.title}”{by}"


def interior_of(place: Location) -> str:
    """INT or EXT for a scene set at ``place``, from its name and kind; the author corrects it."""
    return "EXT" if _OUTSIDE.search(f"{place.name} {place.location_type or ''}") else "INT"


def adapt(
    db: Session,
    novel: Story,
    *,
    fmt: str,
    title: str,
    carry: list[dict],
    series_name: str | None = None,
) -> tuple[Story, Series]:
    """The script of ``novel``: made, put in the series, given the chosen Lorebook and the
    novel's outline. Returns it and its series; the caller commits."""
    if is_script(novel):
        raise AdaptError("Only a novel can be adapted: this story is already a script.")
    if fmt not in SCRIPT_FORMATS:
        raise AdaptError("A novel is adapted as a screenplay or a stage play.")
    story = Story(user_id=novel.user_id, title=title, description=novel.description, adapted_from_id=novel.id)
    db.add(story)
    db.flush()
    series = service.start_next_book(db, novel, story, carry, series_name=series_name)
    book = service.membership(db, story.id)
    if book is not None:
        book.role = ROLES[fmt].format(title=novel.title)
    # The novel's own words about the story are the script's too, until the author says otherwise.
    for key in ("logline", "premise", "central_conflict", "narrative_intent", "synopsis", "paragraph_summary"):
        setattr(story, key, getattr(novel, key))
    story.story_format = fmt
    story.narrative_perspective = ""
    story.intended_length = ""
    story.title_page = {"based_on": based_on(novel), "draft": "First draft"}
    _copy_outline(db, series, novel, story)
    word_count.recount_story(story.id, db)
    return story, series


def _copy_outline(db: Session, series: Series, novel: Story, story: Story) -> None:
    nodes = (
        db.query(StructureNode)
        .filter(StructureNode.story_id == novel.id)
        .order_by(StructureNode.level, StructureNode.position)
        .all()
    )
    parents = {n.parent_id for n in nodes}
    copies: dict[str, StructureNode] = {}
    for node in nodes:
        if node.parent_id and node.parent_id not in copies:
            continue  # under a node that is gone
        copy = StructureNode(
            id=str(uuid.uuid4()),
            story_id=story.id,
            parent_id=copies[node.parent_id].id if node.parent_id else None,
            adapted_from_id=node.id,
            era_id=service.local_equivalent(db, series, "era", node.era_id, story.id),
            status="planned" if node.id not in parents else node.status,
            **{key: getattr(node, key) for key in _PLAN},
        )
        db.add(copy)
        copies[node.id] = copy
    db.flush()
    scenes = [copies[n.id] for n in _reading_order(nodes) if n.id not in parents]
    _carry_scene_links(db, series, story, copies)
    _write_headings(db, story, scenes, copies)


def _reading_order(nodes: list[StructureNode]) -> list[StructureNode]:
    children: dict[str | None, list[StructureNode]] = {}
    for n in nodes:
        children.setdefault(n.parent_id, []).append(n)
    out: list[StructureNode] = []

    def walk(parent: str | None) -> None:
        for n in sorted(children.get(parent, []), key=lambda n: n.position):
            out.append(n)
            walk(n.id)

    walk(None)
    return out


def first_scene(db: Session, story_id: str) -> StructureNode | None:
    """The scene the script opens on, to start writing in."""
    nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    parents = {n.parent_id for n in nodes}
    return next((n for n in _reading_order(nodes) if n.id not in parents), None)


def _carry_scene_links(db: Session, series: Series, story: Story, copies: dict[str, StructureNode]) -> None:
    """Each scene's places, threads and clues, wherever the script has the same element."""

    def here(kind: str, ref_id: str | None) -> str | None:
        return service.local_equivalent(db, series, kind, ref_id, story.id)

    ids = list(copies)
    for s in db.query(SceneSetting).filter(SceneSetting.node_id.in_(ids)).all():
        if place := here("location", s.location_id):
            db.add(SceneSetting(location_id=place, node_id=copies[s.node_id].id, role=s.role, notes=s.notes))
    for a in db.query(PlotThreadAppearance).filter(PlotThreadAppearance.node_id.in_(ids)).all():
        if thread := here("plot_thread", a.thread_id):
            db.add(PlotThreadAppearance(thread_id=thread, node_id=copies[a.node_id].id, role=a.role, note=a.note))
    for c in db.query(TwistClue).filter(TwistClue.node_id.in_(ids)).all():
        if c.node_id and (twist := here("twist", c.twist_id)):
            db.add(
                TwistClue(
                    twist_id=twist,
                    node_id=copies[c.node_id].id,
                    text=c.text,
                    points_to=c.points_to,
                    subtlety=c.subtlety,
                    quote=c.quote,
                    position=c.position,
                )
            )
    for twist in db.query(Twist).filter(Twist.revealed_at_node_id.in_(ids)).all():
        mine = db.get(Twist, here("twist", twist.id) or "")
        if mine is not None and twist.revealed_at_node_id:
            mine.revealed_at_node_id = copies[twist.revealed_at_node_id].id
    db.flush()


def _write_headings(db: Session, story: Story, scenes: list[StructureNode], copies: dict[str, StructureNode]) -> None:
    """Each scene's first line: a screenplay's from the place it is set in, a play's its number,
    with "ACT TWO" before the first scene of each act after the first."""
    primary = {
        s.node_id: s.location
        for s in db.query(SceneSetting)
        .filter(SceneSetting.node_id.in_([s.id for s in scenes]), SceneSetting.role == "primary")
        .all()
    }
    tops = {n.id: n for n in copies.values() if n.parent_id is None}
    acts = story.story_format == "stage_play" and any(n.level_type == "act" for n in tops.values())
    act, number = None, 0
    for scene in scenes:
        lines: list[tuple[str, str]] = []
        if story.story_format == "stage_play":
            top = _top(scene, copies)
            if acts and top is not act:
                if act is not None:
                    lines.append(("heading", f"ACT {_word(sorted(tops.values(), key=_pos).index(top))}"))
                act, number = top, 0
            number += 1
            lines.append(("heading", f"SCENE {number}"))
        elif place := primary.get(scene.id):
            lines.append(("heading", format_slugline(Slug(interior_of(place), place.name, ""))))
        scene.content = "".join(f'<p data-el="{el}">{_escape(text)}</p>' for el, text in lines)
        scene.line_count = word_count.count_lines(story, scene.content)
        derive_heading(scene, story, db)


def _top(node: StructureNode, copies: dict[str, StructureNode]) -> StructureNode:
    by_id = {n.id: n for n in copies.values()}
    while node.parent_id:
        node = by_id[node.parent_id]
    return node


def _pos(node: StructureNode) -> int:
    return node.position


def _word(index: int) -> str:
    return (_NUMBERS[index] if index < len(_NUMBERS) else str(index + 1)).upper()


def _escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def check_source_scene(db: Session, node: StructureNode, scene_id: str | None) -> None:
    """A scene's novel scene must be one of its novel's (the This scene picker, PATCH)."""
    if not scene_id:
        return
    story = db.get(Story, node.story_id)
    source = db.get(StructureNode, scene_id)
    if story is None or source is None or source.story_id != story.adapted_from_id:
        raise AdaptError("That scene is not in the novel this script adapts.")
