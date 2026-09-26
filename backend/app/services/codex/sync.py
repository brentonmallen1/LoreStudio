"""
Building the graph from what the author has already written (doc 07 §2, §8 step 1).

Nothing here invents anything. Every node stands for a row that exists, and every edge for
a link the author made — a relationship, a point of view, a scene set in a location — or
one that follows deterministically from the manuscript, like who speaks in a scene.

A sync rebuilds exactly what it generated (`author` and `derived`) and never touches the
author's own corrections inside Codex (`override`) or a model's unconfirmed proposals
(`llm`), which is the whole reason those are separate sources.
"""

import logging
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from ...models.character import Character, CharacterRelationship
from ...models.codex import SYNCED_SOURCES, CodexEdge, CodexNode
from ...models.dialogue import DialogueBlock
from ...models.location import Location, SceneSetting
from ...models.plot_thread import PlotThread, PlotThreadAppearance
from ...models.scene_link import SceneLink
from ...models.structure import StructureNode
from ...models.twist import Twist
from ..dialogue_service import sync_story_dialogue
from .presence import derive_facts, derive_presence

logger = logging.getLogger(__name__)


@dataclass
class SyncReport:
    """What a sync did, for the jobs list and the tests."""

    nodes: int = 0
    edges: int = 0
    by_kind: dict[str, int] = field(default_factory=dict)

    def count(self, kind: str) -> None:
        self.by_kind[kind] = self.by_kind.get(kind, 0) + 1


class _Graph:
    """Accumulates nodes and edges for one story, then writes them in one go."""

    def __init__(self, story_id: str) -> None:
        self.story_id = story_id
        self.nodes: dict[tuple[str, str], CodexNode] = {}
        self.edges: list[CodexEdge] = []

    def node(self, kind: str, ref_id: str, *, label: str, table: str, summary: str = "", **props) -> CodexNode:
        key = (kind, ref_id)
        if key not in self.nodes:
            self.nodes[key] = CodexNode(
                story_id=self.story_id,
                kind=kind,
                ref_table=table,
                ref_id=ref_id,
                label=label,
                summary=summary or "",
                props=props,
                source="author",
            )
        return self.nodes[key]

    def edge(
        self,
        src: CodexNode | None,
        dst: CodexNode | None,
        kind: str,
        *,
        source: str = "author",
        position: int = 0,
        **props,
    ) -> None:
        # A link to something that no longer exists is not an edge, it is a dangling
        # pointer; the source tables allow those, the graph does not.
        if src is None or dst is None or src is dst:
            return
        self.edges.append(
            CodexEdge(
                story_id=self.story_id,
                src_id=src.id,
                dst_id=dst.id,
                kind=kind,
                props=props,
                source=source,
                position=position,
            )
        )


def _leaves_in_order(nodes: list[StructureNode]) -> list[StructureNode]:
    """Scenes in reading order — the order `follows` edges are built from."""
    children: dict[str | None, list[StructureNode]] = {}
    for node in nodes:
        children.setdefault(node.parent_id, []).append(node)

    def walk(parent: str | None) -> list[StructureNode]:
        out: list[StructureNode] = []
        for node in sorted(children.get(parent, []), key=lambda n: n.position):
            kids = children.get(node.id, [])
            out.extend(walk(node.id) if kids else [node])
        return out

    return walk(None)


def sync_story(story_id: str, db: Session) -> SyncReport:
    """Rebuild the deterministic layer of the graph for one story."""
    sync_story_dialogue(story_id, db)  # "speaks_in" edges come from these rows
    graph = _Graph(story_id)

    characters = db.query(Character).filter(Character.story_id == story_id).all()
    structure = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    locations = db.query(Location).filter(Location.story_id == story_id).all()
    threads = db.query(PlotThread).filter(PlotThread.story_id == story_id).all()
    twists = db.query(Twist).filter(Twist.story_id == story_id).all()

    char_nodes = {
        c.id: graph.node("character", c.id, label=c.name, table="characters", summary=c.personality or "", role=c.role)
        for c in characters
    }
    scene_nodes = {
        n.id: graph.node(
            "scene",
            n.id,
            label=n.title,
            table="structure_nodes",
            summary=n.content_summary or "",
            level_type=n.level_type,
            position=n.position,
        )
        for n in structure
    }
    location_nodes = {
        loc.id: graph.node("location", loc.id, label=loc.name, table="locations", summary=loc.description or "")
        for loc in locations
    }
    thread_nodes = {
        t.id: graph.node("thread", t.id, label=t.name, table="plot_threads", summary=t.description or "")
        for t in threads
    }
    twist_nodes = {
        t.id: graph.node("twist", t.id, label=t.name, table="twists", summary=t.the_truth or "") for t in twists
    }

    # Nodes need ids before edges can point at them.
    _replace_nodes(story_id, db, list(graph.nodes.values()))

    _author_edges(graph, db, story_id, char_nodes, scene_nodes, location_nodes, thread_nodes, twist_nodes, structure)
    _derived_edges(graph, db, story_id, char_nodes, scene_nodes, structure)

    _replace_edges(story_id, db, graph.edges)

    # Presence and facts read the edges above, so they run after them, in order.
    presence = derive_presence(story_id, db)
    knows = derive_facts(story_id, db)

    report = SyncReport(nodes=len(graph.nodes), edges=len(graph.edges) + presence + knows)
    for (kind, _), _node in graph.nodes.items():
        report.count(kind)
    for edge in graph.edges:
        report.count(edge.kind)
    report.by_kind["present_in"] = presence
    report.by_kind["knows"] = knows
    return report


def _author_edges(graph, db, story_id, chars, scenes, locations, threads, twists, structure) -> None:
    """Links the author made explicitly: relationships, POV, settings, threads, twists."""
    for rel in (
        db.query(CharacterRelationship).filter(CharacterRelationship.character_id.in_(list(chars) or [""])).all()
    ):
        graph.edge(
            chars.get(rel.character_id),
            chars.get(rel.related_character_id),
            "rel",
            type=rel.relationship_type,
            visibility=getattr(rel, "visibility", "public"),
        )

    for node in structure:
        if node.pov_character_id:
            graph.edge(scenes.get(node.id), chars.get(node.pov_character_id), "pov")

    for setting in db.query(SceneSetting).filter(SceneSetting.node_id.in_(list(scenes) or [""])).all():
        graph.edge(scenes.get(setting.node_id), locations.get(setting.location_id), "at", role=setting.role)

    for link in db.query(SceneLink).filter(SceneLink.story_id == story_id).all():
        graph.edge(scenes.get(link.source_node_id), scenes.get(link.target_node_id), "links", type=link.link_type)

    for appearance in (
        db.query(PlotThreadAppearance).filter(PlotThreadAppearance.thread_id.in_(list(threads) or [""])).all()
    ):
        graph.edge(scenes.get(appearance.node_id), threads.get(appearance.thread_id), "advances")

    for twist in db.query(Twist).filter(Twist.story_id == story_id).all():
        if twist.revealed_at_node_id:
            graph.edge(twists.get(twist.id), scenes.get(twist.revealed_at_node_id), "revealed_in")
        for index, clue in enumerate(twist.clues or []):
            graph.edge(twists.get(twist.id), scenes.get(clue.get("node_id")), "clue_in", position=index)


def _derived_edges(graph, db, story_id, chars, scenes, structure) -> None:
    """
    What follows from the manuscript itself: reading order, and who speaks where.

    Name matching lives in the presence pass, not here: a name in the prose is a weaker
    signal than a speech tag and deserves to be labelled as one.
    """
    ordered = _leaves_in_order(structure)
    for previous, following in zip(ordered, ordered[1:], strict=False):
        graph.edge(scenes.get(previous.id), scenes.get(following.id), "follows", source="derived")

    for block in db.query(DialogueBlock).filter(DialogueBlock.scene_id.in_(list(scenes) or [""])).all():
        if block.character_id:
            graph.edge(chars.get(block.character_id), scenes.get(block.scene_id), "speaks_in", source="derived")


def _replace_nodes(story_id: str, db: Session, nodes: list[CodexNode]) -> None:
    """
    Swap in the regenerated nodes, keeping the ids of ones that already existed so edges
    the author confirmed still point somewhere.
    """
    existing = {
        (n.kind, n.ref_id): n
        for n in db.query(CodexNode).filter(CodexNode.story_id == story_id, CodexNode.source.in_(SYNCED_SOURCES))
    }
    seen: set[tuple[str, str]] = set()
    for node in nodes:
        key = (node.kind, node.ref_id)
        seen.add(key)
        current = existing.get(key)
        if current:
            current.label, current.summary, current.props = node.label, node.summary, node.props
            node.id = current.id
        else:
            db.add(node)
    for key, node in existing.items():
        if key not in seen:
            db.delete(node)
    db.flush()


def _replace_edges(story_id: str, db: Session, edges: list[CodexEdge]) -> None:
    """Regenerated edges replace regenerated edges. Overrides and proposals are left alone."""
    db.query(CodexEdge).filter(CodexEdge.story_id == story_id, CodexEdge.source.in_(SYNCED_SOURCES)).delete(
        synchronize_session=False
    )
    seen: set[tuple[str, str, str]] = set()
    for edge in edges:
        key = (edge.src_id, edge.dst_id, edge.kind)
        if key in seen:  # the unique constraint is the graph's, not the source table's
            continue
        seen.add(key)
        db.add(edge)
    db.commit()
