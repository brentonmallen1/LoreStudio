"""Answering a proposal (doc 12 P5). Each "yes" writes the authored row it proposes and
records the change, so it can be undone; each "no" removes or marks what proposed it."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from ...models.character import Character, CharacterRelationship
from ...models.discovered_element import DiscoveredElement
from ...models.location import Location
from ...models.proposal_decline import ProposalDecline
from ...models.structure import StructureNode
from ...schemas.proposals import ActResult, Proposal
from .. import change_log
from ..codex.suggest import review
from ..findings.fingerprint import content_hash


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
        review(story_id, db, [ref], accept=True)
        return ActResult()

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
    elif source == "codex":
        review(story_id, db, [ref], accept=False)
        return
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
