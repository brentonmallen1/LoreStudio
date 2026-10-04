"""Answering a proposal (doc 12 P5). Each "yes" writes the authored row it proposes and
records the change, so it can be undone; each "no" removes or marks what proposed it."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from ...models.character import Character, CharacterRelationship
from ...models.codex import CodexEdge, CodexNode
from ...models.discovered_element import DiscoveredElement
from ...models.location import Location, ScenePresence
from ...models.proposal_decline import ProposalDecline
from ...models.reader_knowledge import ReaderKnowledgeEvent
from ...models.structure import StructureNode
from ...models.twist import Twist
from ...schemas.proposals import ActResult, Proposal
from .. import change_log
from ..codex.presence import derive_facts, derive_presence
from ..findings.fingerprint import content_hash
from ..findings.runs import latest_runs, result_of
from ..who_knows import character_ids
from .sources import knowledge_key


class CannotAct(Exception):
    pass


def _create(db: Session, obj, table: str, entity_type: str, story_id: str, label: str, actor, client) -> None:
    db.add(obj)
    db.flush()
    change_log.record_row_create(
        db, obj, table, entity_type=entity_type, story_id=story_id, label=label, actor_id=actor, client_id=client
    )


def act(story_id: str, p: Proposal, action: str, db: Session, actor: str, client: str | None) -> ActResult:
    source, _, ref = p.id.partition(":")
    if action not in {a.id for a in p.actions}:
        raise CannotAct(f"“{action}” is not something this proposal offers")

    if source in ("series-in", "series-same"):
        from ..series.service import SeriesError
        from .series import act_series

        try:
            return act_series(story_id, p, db, actor, client)
        except SeriesError as e:
            raise CannotAct(str(e)) from e

    if source == "stub":
        loc = db.get(Location, ref)
        assert loc is not None
        change_log.record_update(
            db, loc, {"is_stub": False}, entity_type="location", story_id=story_id,
            label=f"Keep {loc.name} as a place", actor_id=actor, client_id=client,
        )  # fmt: skip
        loc.is_stub = False
        db.commit()
        return ActResult(entity_type="location", entity_id=loc.id)

    if source == "discovery":
        d = db.get(DiscoveredElement, ref)
        assert d is not None
        result = ActResult()
        if d.element_type == "character":
            c = Character(
                id=str(uuid.uuid4()), story_id=story_id, name=d.name, background=d.description, role="supporting"
            )
            _create(db, c, "characters", "character", story_id, f"Add {d.name} from a discovery", actor, client)
            result = ActResult(entity_type="character", entity_id=c.id)
        elif d.element_type == "setting":
            loc = Location(id=str(uuid.uuid4()), story_id=story_id, name=d.name, description=d.description)
            _create(db, loc, "locations", "location", story_id, f"Add {d.name} from a discovery", actor, client)
            result = ActResult(entity_type="location", entity_id=loc.id)
        d.status = "approved"
        d.merged_to_type, d.merged_to_id = result.entity_type, result.entity_id
        d.reviewed_at = datetime.now(UTC)
        db.commit()
        return result

    if source == "codex":
        return _answer_codex(story_id, ref, db, actor, client)

    if source == "rk":
        return _add_knowledge(story_id, p, db, actor, client)

    if source == "rel":
        rel = db.get(CharacterRelationship, ref)
        assert rel is not None
        change_log.record_update(
            db, rel, {"is_suggested": False, "suggestion_source": ""}, entity_type="character_relationship",
            story_id=story_id, label="Accept a suggested relationship", actor_id=actor, client_id=client,
        )  # fmt: skip
        rel.is_suggested, rel.suggestion_source = False, ""
        db.commit()
        return ActResult(entity_type="character", entity_id=rel.character_id)

    if source == "dialogue":
        # Tagging is the author's own work: the page opens it for this scene.
        return ActResult(open=ref)

    if source == "name":
        name = p.subject
        if p.kind == "person":
            c = Character(id=str(uuid.uuid4()), story_id=story_id, name=name, role="supporting")
            _create(db, c, "characters", "character", story_id, f"Add {name}, found in the prose", actor, client)
            result = ActResult(entity_type="character", entity_id=c.id)
        else:
            loc = Location(id=str(uuid.uuid4()), story_id=story_id, name=name)
            _create(db, loc, "locations", "location", story_id, f"Add {name}, found in the prose", actor, client)
            result = ActResult(entity_type="location", entity_id=loc.id)
        db.commit()
        return result

    raise CannotAct("Unknown proposal")


def _answer_codex(story_id: str, ref: str, db: Session, actor: str, client: str | None) -> ActResult:
    """Yes to a Codex proposal writes the authored row it proposed, recorded so Undo takes it
    back and the proposal returns (doc 13 P4). The proposal itself is left as it was."""
    edge = db.get(CodexEdge, ref)
    if edge is not None and edge.kind == "present_in":
        character, scene = db.get(CodexNode, edge.src_id), db.get(CodexNode, edge.dst_id)
        if character is None or scene is None:
            raise CannotAct("That scene or character is gone")
        row = ScenePresence(
            id=str(uuid.uuid4()),
            node_id=scene.ref_id,
            character_id=character.ref_id,
            role=(edge.props or {}).get("role") or "participant",
        )
        _create(
            db,
            row,
            "scene_presence",
            "scene_presence",
            story_id,
            f"{character.label} is in {scene.label}",
            actor,
            client,
        )
        db.commit()
        derive_presence(story_id, db)
        return ActResult(entity_type="character", entity_id=character.ref_id)

    fact = db.get(CodexNode, ref)
    if fact is None or fact.kind != "fact":
        raise CannotAct("Unknown proposal")
    established = (
        db.query(CodexEdge).filter(CodexEdge.src_id == fact.id, CodexEdge.kind == "established_in").one_or_none()
    )
    scene = db.get(CodexNode, established.dst_id) if established else None
    event = ReaderKnowledgeEvent(
        id=str(uuid.uuid4()),
        story_id=story_id,
        node_id=scene.ref_id if scene else None,
        subject=fact.label,
        detail=(fact.props or {}).get("quote", ""),
        # What a scene establishes, the reader now knows. It was "a character learns" with
        # nobody named, which read as dramatic irony (doc 18).
        knowledge_type="truth_revealed",
    )
    _create(
        db,
        event,
        "reader_knowledge_events",
        "reader_knowledge_event",
        story_id,
        f"The reader learns: {fact.label}",
        actor,
        client,
    )
    db.commit()
    derive_facts(story_id, db)
    return ActResult()


def _twist_named(story_id: str, name: str | None, db: Session) -> str | None:
    """The twist a scanned event says it serves, by name (any case), if there is one."""
    if not name:
        return None
    want = " ".join(name.split()).casefold()
    for twist in db.query(Twist).filter(Twist.story_id == story_id):
        if " ".join((twist.name or "").split()).casefold() == want:
            return twist.id
    return None


def _add_knowledge(story_id: str, p: Proposal, db: Session, actor: str, client: str | None) -> ActResult:
    """Yes to something the reader-knowledge scan found: the event, as it proposed it."""
    run = latest_runs(story_id, db).get("reader-knowledge-scan")
    ev = next(
        (
            e
            for e in (result_of(run).get("events", []) if run else [])
            if knowledge_key({**e, "node_id": p.node_id}) == p.id
        ),
        None,
    )
    if ev is None:
        raise CannotAct("That scan has been replaced; look at the new one")
    event = ReaderKnowledgeEvent(
        id=str(uuid.uuid4()),
        story_id=story_id,
        node_id=p.node_id,
        knowledge_type=ev.get("knowledge_type") or "truth_revealed",
        subject=p.subject,
        detail=ev.get("detail") or "",
        reader_knows=ev.get("reader_knows", True),
        characters_who_know=character_ids(story_id, ev.get("characters_who_know") or [], db),
        is_truth=ev.get("is_truth", True),
        twist_id=_twist_named(story_id, ev.get("twist"), db),
    )
    _create(
        db,
        event,
        "reader_knowledge_events",
        "reader_knowledge_event",
        story_id,
        f"The reader learns: {p.subject}",
        actor,
        client,
    )
    db.commit()
    return ActResult()


def decline(story_id: str, p: Proposal, db: Session, actor: str, client: str | None) -> None:
    source, _, ref = p.id.partition(":")
    if source == "stub":
        loc = db.get(Location, ref)
        assert loc is not None
        change_log.record(
            db, story_id=story_id, entity_type="location", entity_id=loc.id, action="delete",
            before=change_log.capture_location(loc, db), after=None,
            label=f"Not a place: {loc.name}", actor_id=actor, client_id=client,
        )  # fmt: skip
        db.delete(loc)
    elif source == "discovery":
        d = db.get(DiscoveredElement, ref)
        assert d is not None
        d.status, d.reviewed_at = "rejected", datetime.now(UTC)
    elif source == "rel":
        rel = db.get(CharacterRelationship, ref)
        assert rel is not None
        change_log.record_row_delete(
            db, rel, "character_relationships", entity_type="character_relationship", story_id=story_id,
            label="Decline a suggested relationship", actor_id=actor, client_id=client,
        )  # fmt: skip
        db.delete(rel)
    else:
        node = db.get(StructureNode, p.node_id) if source == "dialogue" and p.node_id else None
        row = ProposalDecline(
            id=str(uuid.uuid4()),
            story_id=story_id,
            fingerprint=p.id,
            node_content_hash=content_hash(node.content) if node is not None else None,
        )
        existing = (
            db.query(ProposalDecline)
            .filter(ProposalDecline.story_id == story_id, ProposalDecline.fingerprint == p.id)
            .first()
        )
        if existing is not None:
            existing.node_content_hash = row.node_content_hash
        else:
            db.add(row)
            db.flush()
            change_log.record_row_create(
                db, row, "proposal_declines", entity_type="proposal_decline", story_id=story_id,
                label="Decline a proposal", actor_id=actor, client_id=client,
            )  # fmt: skip
    db.commit()
