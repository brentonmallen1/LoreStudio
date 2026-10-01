"""Where proposals come from, one reader per source (doc 12 P5). Nothing here writes."""

from __future__ import annotations

import hashlib
import re

from sqlalchemy.orm import Session

from ...models.character import Character, CharacterRelationship
from ...models.discovered_element import DiscoveredElement
from ...models.location import Location
from ...models.reader_knowledge import ReaderKnowledgeEvent
from ...models.structure import StructureNode
from ...schemas.proposals import Proposal, ProposalAction, ProposalKind
from ..codex.queue import pending_suggestions
from ..dialogue_tagging import suggest_tags
from ..findings.fingerprint import content_hash
from ..findings.runs import latest_runs, result_of
from ..text_utils import html_to_text


def name_key(kind: str, name: str) -> str:
    return f"name:{kind}:{hashlib.sha1(name.strip().lower().encode()).hexdigest()[:12]}"


def stubs(story_id: str, db: Session, titles: dict[str, str]) -> list[Proposal]:
    """Places made from the prose, waiting for the author to keep them or not."""
    out = []
    for loc in db.query(Location).filter(Location.story_id == story_id, Location.is_stub.is_(True)):
        out.append(
            Proposal(
                id=f"stub:{loc.id}",
                kind="place",
                source="ai" if loc.discovered_from_id else "local",
                text=f"A place called “{loc.name}” turns up in your prose",
                subject=loc.name,
                evidence=(loc.description or "")[:240],
                actions=[ProposalAction(id="keep", label="Add to Places", primary=True)],
                decline="Not a place",
                created_at=loc.discovered_at,
            )
        )
    return out


def discoveries(story_id: str, db: Session, titles: dict[str, str]) -> list[Proposal]:
    kinds: dict[str, ProposalKind] = {"character": "person", "setting": "place"}
    out = []
    rows = db.query(DiscoveredElement).filter(
        DiscoveredElement.story_id == story_id, DiscoveredElement.status == "pending"
    )
    for d in rows:
        kind: ProposalKind = kinds.get(d.element_type, "fact")
        verb = {"person": "Add as a character", "place": "Add to Places"}.get(kind, "Noted")
        out.append(
            Proposal(
                id=f"discovery:{d.id}",
                kind=kind,
                source="ai",
                text=d.name + (f": {d.description}" if d.description else ""),
                subject=d.name,
                evidence=d.source_excerpt or "",
                node_id=d.source_node_id,
                where=titles.get(d.source_node_id or "", ""),
                actions=[ProposalAction(id="approve", label=verb, primary=True)],
                created_at=d.created_at,
            )
        )
    return out


def codex(story_id: str, db: Session, titles: dict[str, str]) -> list[Proposal]:
    out = []
    for s in pending_suggestions(story_id, db):
        out.append(
            Proposal(
                id=f"codex:{s.id}",
                kind="presence" if s.kind == "presence" else "fact",
                source="ai",
                text=s.statement
                if s.kind != "presence"
                else s.statement.replace("this scene", s.scene_title or "a scene"),
                evidence=s.quote,
                node_id=s.scene_id,
                where=s.scene_title,
                actions=[
                    ProposalAction(
                        id="confirm",
                        label="Yes, they're here" if s.kind == "presence" else "The reader knows this",
                        primary=True,
                    )
                ],
            )
        )
    return out


def relationships(story_id: str, db: Session, titles: dict[str, str]) -> list[Proposal]:
    names = {c.id: c.name for c in db.query(Character).filter(Character.story_id == story_id)}
    out = []
    rows = db.query(CharacterRelationship).filter(
        CharacterRelationship.character_id.in_(list(names)), CharacterRelationship.is_suggested.is_(True)
    )
    for r in rows:
        kind = (r.relationship_type or "a relationship").replace("_", " ")
        out.append(
            Proposal(
                id=f"rel:{r.id}",
                kind="relationship",
                source="ai",
                text=f"{names.get(r.character_id, '?')} and {names.get(r.related_character_id, '?')}: {kind}",
                evidence=r.description or "",
                actions=[ProposalAction(id="accept", label="Add the relationship", primary=True)],
            )
        )
    return out


def unattributed(story_id: str, db: Session, titles: dict[str, str]) -> list[Proposal]:
    """Dialogue with no speaker, one proposal per scene, counted by the tagger's own
    detector (doc 13 P4): "Tag them" opens on exactly these lines."""
    chars = {c.name.lower(): c for c in db.query(Character).filter(Character.story_id == story_id)}
    out = []
    for scene in db.query(StructureNode).filter(
        StructureNode.story_id == story_id, StructureNode.content.isnot(None), StructureNode.content != ""
    ):
        lines = suggest_tags(scene, chars)
        if not lines:
            continue
        n = len(lines)
        out.append(
            Proposal(
                id=f"dialogue:{scene.id}",
                kind="dialogue",
                source="local",
                text=f"{n} {'line' if n == 1 else 'lines'} of dialogue with no speaker",
                evidence=lines[0].quote_content[:200],
                node_id=scene.id,
                where=titles.get(scene.id, ""),
                actions=[ProposalAction(id="tag", label="Tag them", primary=True)],
                decline="Leave them",
            )
        )
    return out


def scanned_names(story_id: str, db: Session, titles: dict[str, str]) -> list[Proposal]:
    """Names the local scan found in the prose and the Lorebook does not have, from its
    latest run."""
    run = latest_runs(story_id, db).get("entity-suggestions")
    if run is None:
        return []
    result = result_of(run)
    known = {c.name for c in db.query(Character).filter(Character.story_id == story_id)}
    known |= {loc.name for loc in db.query(Location).filter(Location.story_id == story_id)}
    known |= {d.name for d in db.query(DiscoveredElement).filter(DiscoveredElement.story_id == story_id)}
    known_words = {w for name in known for w in _words(name)}
    lowercase = _lowercase_words(story_id, db)
    out = []
    found: tuple[tuple[str, ProposalKind, str], ...] = (
        ("character_suggestions", "person", "Add as a character"),
        ("location_suggestions", "place", "Add to Places"),
    )
    for key, kind, verb in found:
        for s in result.get(key, []):
            name = _clean(s.get("text") or "")
            words = _words(name)
            # Known when every word of it is a word of a name the story has: "Calder" is
            # "The Visitor (Calder)", "Vance" is one of the Vances.
            if not words or all(w in known_words for w in words):
                continue
            scenes = s.get("scene_ids") or []
            n = s.get("occurrences", 1)
            # One capitalised word is often just a word at the start of a sentence: drop it
            # when the prose also uses it in lower case ("barometer"), or uses it only once.
            if len(words) == 1 and (words[0] in lowercase or n < 2):
                continue
            out.append(
                Proposal(
                    id=name_key(kind, name),
                    kind=kind,
                    source="local",
                    text=f"{name}, named {'once' if n == 1 else f'{n} times'}",
                    subject=name,
                    node_id=scenes[0] if scenes else None,
                    where=", ".join(s.get("scene_titles") or [])[:120],
                    actions=[ProposalAction(id="add", label=verb, primary=True)],
                    created_at=run.created_at,
                )
            )
    return out


_WORD = re.compile(r"[^\W\d_][\w'’]*")
_LOWER = re.compile(r"(?<![\w'’])[a-z][a-z'’]+")


def _lowercase_words(story_id: str, db: Session) -> set[str]:
    """Every word the prose writes in lower case somewhere."""
    out: set[str] = set()
    for (content,) in db.query(StructureNode.content).filter(StructureNode.story_id == story_id):
        out.update(_LOWER.findall(html_to_text(content or "")))
    return out


KNOWLEDGE_LABELS = {
    "truth_revealed": "The reader learns",
    "misdirection_planted": "A misdirection",
    "clue_planted": "A clue",
    "character_learns": "A character learns",
    "reader_only": "Only the reader knows",
}


def knowledge_key(event: dict) -> str:
    raw = f"{event.get('node_id') or ''}|{(event.get('subject') or '').strip().lower()}"
    return f"rk:{hashlib.sha1(raw.encode()).hexdigest()[:12]}"


def scanned_knowledge(story_id: str, db: Session, titles: dict[str, str]) -> list[Proposal]:
    """What the Assistant's reader-knowledge scan found, waiting for a yes (doc 13 P4). An
    event the author already has (same scene, same subject) is not proposed again."""
    run = latest_runs(story_id, db).get("reader-knowledge-scan")
    if run is None:
        return []
    have = {
        (e.node_id, e.subject.strip().lower())
        for e in db.query(ReaderKnowledgeEvent).filter(ReaderKnowledgeEvent.story_id == story_id)
    }
    out = []
    for ev in result_of(run).get("events", []):
        subject = (ev.get("subject") or "").strip()
        node_id = ev.get("node_id") if ev.get("node_id") in titles else None
        if not subject or (node_id, subject.lower()) in have:
            continue
        out.append(
            Proposal(
                id=knowledge_key({**ev, "node_id": node_id}),
                kind="fact",
                source="ai",
                text=f"{KNOWLEDGE_LABELS.get(ev.get('knowledge_type', ''), 'The reader learns')}: {subject}",
                subject=subject,
                evidence=(ev.get("detail") or "")[:240],
                node_id=node_id,
                where=titles.get(node_id or "", ""),
                actions=[ProposalAction(id="add", label="Add to what the reader knows", primary=True)],
                created_at=run.created_at,
            )
        )
    return out


def _words(name: str) -> list[str]:
    return [w.lower() for w in _WORD.findall(name) if len(w) > 2]


def _clean(name: str) -> str:
    """Strip what the prose's markup leaves on a name a scan found: "@", "<", ">"."""
    return re.sub(r"\s+", " ", re.sub(r"^[^\w]+|[^\w'’.]+$", "", name)).strip()


def reading_order(story_id: str, db: Session) -> dict[str, int]:
    """Each node's place in the book, depth first, so the inbox reads front to back."""
    nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).all()
    children: dict[str | None, list[StructureNode]] = {}
    for n in nodes:
        children.setdefault(n.parent_id, []).append(n)
    order: dict[str, int] = {}

    def walk(parent: str | None) -> None:
        for n in sorted(children.get(parent, []), key=lambda n: n.position):
            order[n.id] = len(order)
            walk(n.id)

    walk(None)
    return order


def scene_titles(story_id: str, db: Session) -> dict[str, str]:
    return {
        n.id: n.title or "Untitled scene" for n in db.query(StructureNode).filter(StructureNode.story_id == story_id)
    }


def scene_hashes(story_id: str, db: Session) -> dict[str, str]:
    return {n.id: content_hash(n.content) for n in db.query(StructureNode).filter(StructureNode.story_id == story_id)}


SOURCES = (stubs, discoveries, codex, relationships, unattributed, scanned_names, scanned_knowledge)
