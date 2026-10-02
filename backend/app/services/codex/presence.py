"""
Who was in a scene, and what they took away from it (doc 07 §3).

These are the two derived layers the rest of the system leans on. Presence answers "was
this character there", from the strongest signal available: the author naming them as the
point of view, a line of dialogue attributed to them, or their name in the prose. Knowing
answers "did they learn this", which is presence plus what the author recorded about who
knows what.

Name matching is the weakest of the three signals, and labelled as such — "mentioned" is not "present", and a character mentioned in absentia
should not be told they were in the room.
"""

import logging
import re
from collections import Counter

from sqlalchemy.orm import Session

from ...models.character import Character
from ...models.codex import SYNCED_SOURCES, CodexEdge, CodexNode, settled_edges
from ...models.location import ScenePresence
from ...models.reader_knowledge import ReaderKnowledgeEvent
from ...models.structure import StructureNode
from ...models.twist import Twist

logger = logging.getLogger(__name__)

#: Presence strong enough to have witnessed what happened. "mentioned" is not on this list
#: on purpose: being named in a scene is not being in it.
WITNESSING_ROLES = ("pov", "participant")

POV = "pov"
DIALOGUE = "dialogue"
MENTION = "mention"


_TAG = re.compile(r"<[^>]+>")
_PARENTHETICAL = re.compile(r"^(?P<outer>.*?)\s*\((?P<inner>[^)]+)\)\s*$")
_ARTICLES = {"the", "a", "an"}


def name_forms(label: str) -> set[str]:
    """
    The ways prose refers to a character by name.

    A label is how the Lorebook files someone, not how a sentence says them: "Eleanor
    Vance" is "Eleanor" on the page, and "The Visitor (Calder)" is either half. Matching
    the whole label found almost nobody, so protagonists came out absent from their own
    scenes. Same rule as the entity linker: full name, and a multi-word name's first word
    — unless that word is an article, because "The" is not anybody.
    """
    label = " ".join(label.split())
    if not label:
        return set()
    forms = {label}
    parts = [label]
    if m := _PARENTHETICAL.match(label):
        parts = [m.group("outer"), m.group("inner")]
        forms |= {p for p in parts if p}
    for part in parts:
        words = part.split()
        if len(words) > 1 and words[0].lower() not in _ARTICLES:
            forms.add(words[0])
    return forms


def _pattern(form: str) -> re.Pattern[str]:
    # A one-word form must be capitalised as written, or "will" is Will and "grace" is
    # Grace. A longer form is distinctive enough to match however it is cased.
    flags = 0 if " " not in form else re.IGNORECASE
    return re.compile(rf"(?<![\w@])@?{re.escape(form)}(?!\w)", flags)


def known_as(character) -> list[str]:
    """A character's name and the other names the prose uses for them."""
    return [character.name or "", *(character.aliases or [])]


def name_patterns(labels: dict[str, str | list[str]]) -> dict[str, list[re.Pattern[str]]]:
    """
    Patterns per character id, from a label or several (a name and its aliases). A form
    that belongs to two characters is evidence for neither — two Vances share a surname,
    and a shared first name is no better.
    """
    forms = {
        key: set().union(*(name_forms(label) for label in ([labels] if isinstance(labels, str) else labels)))
        for key, labels in labels.items()
    }
    owners = Counter(form.lower() for fs in forms.values() for form in fs)
    return {
        key: [_pattern(form) for form in sorted(fs, key=len, reverse=True) if owners[form.lower()] == 1]
        for key, fs in forms.items()
    }


def plain_text(html: str) -> str:
    return _TAG.sub(" ", html or "")


def _nodes_by_kind(story_id: str, db: Session, kind: str) -> dict[str, CodexNode]:
    return {n.ref_id: n for n in db.query(CodexNode).filter(CodexNode.story_id == story_id, CodexNode.kind == kind)}


def _authored_presence(scene_refs: list[str], db: Session) -> dict[tuple[str, str], ScenePresence]:
    """(scene ref, character ref) -> the author's answer, where they gave one."""
    if not scene_refs:
        return {}
    rows = db.query(ScenePresence).filter(ScenePresence.node_id.in_(scene_refs)).all()
    return {(row.node_id, row.character_id): row for row in rows}


def derive_presence(story_id: str, db: Session) -> int:
    """
    Rebuild derived `present_in` edges. Author overrides are left exactly as they are —
    including an override that says a character was *not* there.
    """
    characters = _nodes_by_kind(story_id, db, "character")
    scenes = _nodes_by_kind(story_id, db, "scene")
    if not characters or not scenes:
        return 0

    authored = _authored_presence([n.ref_id for n in scenes.values()], db)
    # Only what this pass generated. An `llm` proposal is waiting for the author, and a
    # rebuild that quietly dropped it would empty the review queue behind their back.
    db.query(CodexEdge).filter(
        CodexEdge.story_id == story_id,
        CodexEdge.kind == "present_in",
        CodexEdge.source.in_(SYNCED_SOURCES),
    ).delete(synchronize_session=False)

    pov_by_scene = {
        e.src_id: e.dst_id for e in db.query(CodexEdge).filter(CodexEdge.story_id == story_id, CodexEdge.kind == "pov")
    }
    speakers = {
        (e.src_id, e.dst_id)
        for e in db.query(CodexEdge).filter(CodexEdge.story_id == story_id, CodexEdge.kind == "speaks_in")
    }

    prose = {
        node.id: plain_text(node.content) for node in db.query(StructureNode).filter(StructureNode.story_id == story_id)
    }
    aliases = {c.id: c.aliases for c in db.query(Character).filter(Character.story_id == story_id)}
    patterns = name_patterns({key: [node.label or "", *(aliases.get(key) or [])] for key, node in characters.items()})

    made = 0
    for scene_ref, scene_node in scenes.items():
        text = prose.get(scene_ref, "")
        for char_ref, char_node in characters.items():
            basis, role = None, None
            stated = authored.get((scene_ref, char_ref))
            if stated:
                # The author has answered for this scene; nothing derived overrules it.
                basis, role = "manual", stated.role
            elif pov_by_scene.get(scene_node.id) == char_node.id:
                basis, role = POV, "pov"
            elif (char_node.id, scene_node.id) in speakers:
                basis, role = DIALOGUE, "participant"
            elif any(p.search(text) for p in patterns[char_ref]):
                basis, role = MENTION, "mentioned"
            if not basis:
                continue
            db.add(
                CodexEdge(
                    story_id=story_id,
                    src_id=char_node.id,
                    dst_id=scene_node.id,
                    kind="present_in",
                    props={"basis": basis, "role": role},
                    source="author" if basis == "manual" else "derived",
                    confidence=0.5 if basis == MENTION else 1.0,
                )
            )
            made += 1
    db.commit()
    return made


def set_presence(node_id: str, character_id: str, role: str, db: Session) -> ScenePresence:
    """
    Record the author's answer about one character in one scene ("Who is here").

    It goes in the Lorebook, not the graph: `role="absent"` is how you say that a name in
    the prose was someone being talked about, and that is a fact about the story rather
    than a correction to a derivation. Callers re-derive presence afterwards.
    """
    row = (
        db.query(ScenePresence)
        .filter(ScenePresence.node_id == node_id, ScenePresence.character_id == character_id)
        .one_or_none()
    )
    if not row:
        row = ScenePresence(node_id=node_id, character_id=character_id)
        db.add(row)
    row.role = role
    db.commit()
    db.refresh(row)
    return row


def derive_facts(story_id: str, db: Session) -> int:
    """
    Turn what the author recorded about knowledge into fact nodes and `knows` edges.

    Sources are the reader-knowledge events and twist reveals they already wrote. A
    character knows a fact when the author listed them, or when they were present as more
    than a mention in the scene where it was established — being in the room is enough,
    being talked about is not.
    """
    scenes = _nodes_by_kind(story_id, db, "scene")
    characters_by_node_id = {n.id: n for n in _nodes_by_kind(story_id, db, "character").values()}
    char_by_ref = _nodes_by_kind(story_id, db, "character")

    witnessed: dict[str, set[str]] = {}  # scene node id -> character node ids
    # Settled only: an unconfirmed proposal that someone was in the room must not hand
    # them everything that happened there.
    for edge in db.query(CodexEdge).filter(
        CodexEdge.story_id == story_id, CodexEdge.kind == "present_in", settled_edges()
    ):
        if (edge.props or {}).get("role") in WITNESSING_ROLES:
            witnessed.setdefault(edge.dst_id, set()).add(edge.src_id)

    facts: list[tuple[str, str, str, str | None, list[str]]] = []
    for event in db.query(ReaderKnowledgeEvent).filter(ReaderKnowledgeEvent.story_id == story_id):
        facts.append(
            (event.id, event.subject, event.detail or "", event.node_id, list(event.characters_who_know or []))
        )
    for twist in db.query(Twist).filter(Twist.story_id == story_id):
        if twist.revealed_at_node_id and twist.the_truth:
            facts.append((f"twist:{twist.id}", twist.name, twist.the_truth, twist.revealed_at_node_id, []))

    # Facts are regenerated wholesale; the author's own `knows` links are overrides and stay.
    existing = {
        n.ref_id: n
        for n in db.query(CodexNode).filter(
            CodexNode.story_id == story_id, CodexNode.kind == "fact", CodexNode.source.in_(SYNCED_SOURCES)
        )
    }
    db.query(CodexEdge).filter(
        CodexEdge.story_id == story_id, CodexEdge.kind.in_(["knows", "established_in"]), CodexEdge.source == "derived"
    ).delete(synchronize_session=False)

    seen: set[str] = set()
    made = 0
    for ref_id, label, detail, node_id, known_by in facts:
        seen.add(ref_id)
        fact = existing.get(ref_id)
        if fact:
            fact.label, fact.summary = label, detail
        else:
            fact = CodexNode(
                story_id=story_id,
                kind="fact",
                ref_table="reader_knowledge_events",
                ref_id=ref_id,
                label=label,
                summary=detail,
                source="author",
            )
            db.add(fact)
            db.flush()

        scene_node = scenes.get(node_id) if node_id else None
        if scene_node:
            db.add(
                CodexEdge(
                    story_id=story_id,
                    src_id=fact.id,
                    dst_id=scene_node.id,
                    kind="established_in",
                    source="derived",
                )
            )

        knowers = {char_by_ref[c].id for c in known_by if c in char_by_ref}
        if scene_node:
            knowers |= witnessed.get(scene_node.id, set())
        for char_node_id in knowers:
            if char_node_id not in characters_by_node_id:
                continue
            db.add(
                CodexEdge(
                    story_id=story_id,
                    src_id=char_node_id,
                    dst_id=fact.id,
                    kind="knows",
                    props={"learned_in": node_id} if node_id else {},
                    source="derived",
                )
            )
            made += 1

    for ref_id, node in existing.items():
        if ref_id not in seen:
            db.delete(node)
    db.commit()
    return made
