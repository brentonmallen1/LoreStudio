"""
The review step (doc 20 P3): changing a character's pronouns or name proposes the sentences that
should follow, and applies what the author ticks as one change, undone with one Undo, after a
named version of the story is saved. Quick runs here, on this machine, in both modes.
"""

from __future__ import annotations

import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.character import Character
from ..models.location import ScenePresence
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.character_review import ApplyOut, ApplyRequest, ReviewItem, ReviewOut, ReviewRequest, ReviewScene
from ..services import change_log, other_names
from ..services.pronoun_review import SETS, patterns_for, people_on_page, pronoun_set, review_scene
from ..services.prose_html import Edit, apply_edits, paragraphs
from ..services.scene_cast import on_the_page
from ..services.snapshot_service import create_snapshot
from ..services.structure_order import order_of
from .characters import _verify_character_access

router = APIRouter()


def _scenes(story: Story, db: Session) -> list[StructureNode]:
    """The written scenes, in reading order."""
    nodes = db.query(StructureNode).filter(StructureNode.story_id == story.id).all()
    parents = {n.parent_id for n in nodes if n.parent_id}
    order = order_of(nodes)
    return sorted((n for n in nodes if n.id not in parents and (n.content or "").strip()), key=lambda n: order[n.id])


def _stamp(node: StructureNode) -> str:
    return node.updated_at.isoformat() if node.updated_at else ""


@router.post("/{character_id}/review", response_model=ReviewOut)
def review(
    character_id: str,
    body: ReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    me = _verify_character_access(character_id, db, current_user)
    story = db.get(Story, me.story_id)
    assert story is not None
    characters = db.query(Character).filter(Character.story_id == story.id).all()
    scenes = _scenes(story, db)
    patterns = patterns_for(characters)
    answers: dict[str, list[ScenePresence]] = defaultdict(list)
    for row in db.query(ScenePresence).filter(ScenePresence.node_id.in_([s.id for s in scenes])).all():
        answers[row.node_id].append(row)
    on_page = {
        s.id: on_the_page(s.content, patterns, answers[s.id], s.pov_character_id or story.pov_character_id)
        for s in scenes
    }
    people = people_on_page([s.id for s in scenes], on_page, characters)

    new_set = pronoun_set(body.pronouns_to or me.pronouns)
    if body.slips:
        old_sets = [k for k in SETS if k not in (new_set, "it")]
    else:
        old_sets = [pronoun_set(body.pronouns_from)] if body.pronouns_from else []
    unsupported = ""
    if (body.pronouns_to or body.slips) and new_set is None:
        unsupported = (
            f"“{body.pronouns_to or me.pronouns}” has no set of words to rewrite to, so no pronoun is proposed."
        )
    elif body.pronouns_from and old_sets == [None]:
        unsupported = f"“{body.pronouns_from}” has no set of words to look for, so no pronoun is proposed."

    items: list[ReviewItem] = []
    for scene in scenes:
        here = me.id in on_page[scene.id]
        props = []
        if body.name_from and body.name_to:
            props += review_scene(scene.id, scene.content, me, old_set=None, new_set=None, on_page=[], patterns={},
                                  old_name=body.name_from, new_name=body.name_to)  # fmt: skip
        for old in old_sets if here and new_set else []:
            if old and old != new_set:
                props += review_scene(scene.id, scene.content, me, old_set=old, new_set=new_set,
                                      on_page=people[scene.id], patterns=patterns, named_only=body.slips)  # fmt: skip
        items += [
            ReviewItem(
                id=p.id,
                node_id=p.node_id,
                para=p.para,
                kind=p.kind,
                sure=p.sure,
                sent_start=p.sent_start,
                sent_end=p.sent_end,
                before=p.before,
                after=p.after,
                note=p.note,
                edits=[e.__dict__ for e in p.edits],
            )  # fmt: skip
            for p in props
        ]
    touched = {i.node_id for i in items}
    return ReviewOut(
        items=items,
        scenes=[
            ReviewScene(node_id=s.id, title=s.title or "Untitled", updated_at=_stamp(s))
            for s in scenes
            if s.id in touched
        ],
        unsupported=unsupported,
    )


@router.post("/{character_id}/review/apply", response_model=ApplyOut)
def apply_review(
    character_id: str,
    body: ApplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    me = _verify_character_access(character_id, db, current_user)
    change = " and ".join(
        part
        for part in (f"{body.pronouns}" if body.pronouns else "", f"the name {body.name}" if body.name else "")
        if part
    )
    label = f"{me.name}: {change}" if change else f"Pronoun fixes for {me.name}"
    if body.items:
        # A named version first, so even a regret found much later has a way back.
        create_snapshot(me.story_id, db, trigger="manual", name=f"Before {change or 'pronoun fixes'} for {me.name}")
    batch = str(uuid.uuid4())
    write = change_log.prose_writer(db, label=label, batch_id=batch, actor_id=current_user.id, client_id=client_id)

    by_node: dict[str, list] = defaultdict(list)
    for item in body.items:
        by_node[item.node_id].append(item)
    applied, not_placed, skipped = 0, 0, []
    for node_id, items in by_node.items():
        node = db.get(StructureNode, node_id)
        if node is None or node.story_id != me.story_id:
            continue
        if body.seen.get(node_id) and body.seen[node_id] != _stamp(node):
            skipped.append(node.title or "Untitled")
            continue
        paras = paragraphs(node.content or "")
        edits: list[Edit] = []
        for item in items:
            if item.para >= len(paras):
                not_placed += 1
                continue
            para = paras[item.para]
            if item.hand is not None:
                ok = para.text[item.sent_start : item.sent_end] == item.before
                new = [Edit(para, item.sent_start, item.sent_end, item.hand)] if ok else []
            else:
                ok = all(para.text[e.start : e.end] == e.was for e in item.edits)
                new = [Edit(para, e.start, e.end, e.text) for e in item.edits] if ok else []
            edits += new
            not_placed += 0 if ok else 1
        html, count = apply_edits(node.content or "", edits)
        not_placed += len(edits) - count
        if count:
            write(node, html)
            node.summary_stale = True
            applied += count

    data: dict = {}
    if body.pronouns is not None:
        data["pronouns"] = body.pronouns
    if body.name:
        data["name"] = body.name
        db.flush()
        other_names.settle(me, data, "character", db)
    change_log.record_update(
        db, me, data, entity_type="character", story_id=me.story_id, label=label,
        actor_id=current_user.id, client_id=client_id, batch_id=batch,
    )  # fmt: skip
    for key, value in data.items():
        setattr(me, key, value)
    db.commit()
    db.refresh(me)
    return ApplyOut(character=me, applied=applied, skipped=skipped, not_placed=not_placed)
