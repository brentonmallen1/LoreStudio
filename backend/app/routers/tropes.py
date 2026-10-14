"""Tropes in play (doc 27): what the author does with a trope, and where it plays."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.character import Character, CharacterRelationship
from ..models.compendium import CompendiumEntry
from ..models.plot_thread import PlotThread
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.trope import Trope, TropeLink
from ..models.user import User
from ..schemas.trope import (
    TropeCreate,
    TropeLinkCreate,
    TropeLinkOut,
    TropeLinkUpdate,
    TropeOut,
    TropeReorder,
    TropeUpdate,
)
from ..services import change_log
from ..services.patching import check_nodes, patch_fields
from ..services.tropes import link_target_name, trope_out

router = APIRouter()


def _verify_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_trope(trope_id: str, db: Session, user: User) -> Trope:
    trope = db.get(Trope, trope_id)
    if not trope:
        raise HTTPException(status_code=404, detail="Trope not found")
    _verify_story(trope.story_id, db, user)
    return trope


def _verify_link(link_id: str, db: Session, user: User) -> tuple[TropeLink, Trope]:
    link = db.get(TropeLink, link_id)
    if not link:
        raise HTTPException(status_code=404, detail="That trope does not play there")
    return link, _verify_trope(link.trope_id, db, user)


def _check_refs(db: Session, story_id: str, data: dict) -> None:
    """The thread and the definition, when set, are this story's."""
    thread_id = data.get("thread_id")
    if thread_id:
        thread = db.get(PlotThread, thread_id)
        if thread is None or thread.story_id != story_id:
            raise HTTPException(status_code=422, detail="thread_id: no such thread in this story")
    definition_id = data.get("definition_id")
    if definition_id:
        entry = db.get(CompendiumEntry, definition_id)
        if entry is None or entry.story_id != story_id:
            raise HTTPException(status_code=422, detail="definition_id: no such Compendium entry in this story")


def _check_target(db: Session, story_id: str, body: TropeLinkCreate) -> None:
    check_nodes(db, story_id, {"node_id": body.node_id}, ("node_id",))
    if body.character_id:
        character = db.get(Character, body.character_id)
        if character is None or character.story_id != story_id:
            raise HTTPException(status_code=422, detail="character_id: no such character in this story")
    if body.relationship_id:
        rel = db.get(CharacterRelationship, body.relationship_id)
        owner = db.get(Character, rel.character_id) if rel else None
        if owner is None or owner.story_id != story_id:
            raise HTTPException(status_code=422, detail="relationship_id: no such relationship in this story")


@router.get("/stories/{story_id}/tropes", response_model=list[TropeOut])
def list_tropes(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _verify_story(story_id, db, current_user)
    tropes = (
        db.query(Trope).filter(Trope.story_id == story_id).order_by(Trope.position.asc(), Trope.created_at.asc()).all()
    )
    return [trope_out(t, db) for t in tropes]


@router.post("/stories/{story_id}/tropes", response_model=TropeOut, status_code=status.HTTP_201_CREATED)
def create_trope(
    story_id: str,
    body: TropeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _verify_story(story_id, db, current_user)
    data = body.model_dump()
    data["name"] = data["name"].strip()
    if not data["name"]:
        raise HTTPException(status_code=422, detail="A trope needs a name")
    _check_refs(db, story_id, data)
    last = db.query(Trope.position).filter(Trope.story_id == story_id).order_by(Trope.position.desc()).first()
    trope = Trope(story_id=story_id, position=(last[0] + 1) if last else 0, **data)
    db.add(trope)
    db.flush()
    change_log.record_row_create(
        db,
        trope,
        "tropes",
        entity_type="trope",
        story_id=story_id,
        label=f"Add trope {trope.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(trope)
    return trope_out(trope, db)


@router.patch("/tropes/{trope_id}", response_model=TropeOut)
def update_trope(
    trope_id: str,
    body: TropeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    trope = _verify_trope(trope_id, db, current_user)
    data = patch_fields(body, nullable={"thread_id", "definition_id"})
    if "name" in data:
        data["name"] = data["name"].strip()
        if not data["name"]:
            raise HTTPException(status_code=422, detail="A trope needs a name")
    _check_refs(db, trope.story_id, data)
    change_log.record_update(
        db,
        trope,
        data,
        entity_type="trope",
        story_id=trope.story_id,
        label=f"Edit {{fields}} on trope {trope.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(trope, key, value)
    db.commit()
    db.refresh(trope)
    return trope_out(trope, db)


@router.delete("/tropes/{trope_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trope(
    trope_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    trope = _verify_trope(trope_id, db, current_user)
    change_log.record(
        db,
        story_id=trope.story_id,
        entity_type="trope",
        entity_id=trope.id,
        action="delete",
        before=change_log.capture_trope(trope, db),
        after=None,
        label=f"Delete trope {trope.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(trope)
    db.commit()


@router.post("/stories/{story_id}/tropes/reorder", response_model=list[TropeOut])
def reorder_tropes(
    story_id: str,
    body: TropeReorder,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _verify_story(story_id, db, current_user)
    tropes = {t.id: t for t in db.query(Trope).filter(Trope.story_id == story_id).all()}
    if set(body.ids) != set(tropes):
        raise HTTPException(status_code=422, detail="Reorder must list every trope of the story once")
    before = change_log.reorder_snapshot(Trope, list(body.ids), db)
    for i, tid in enumerate(body.ids):
        tropes[tid].position = i
    db.flush()
    after = change_log.reorder_snapshot(Trope, list(body.ids), db)
    if before != after:
        change_log.record(
            db,
            story_id=story_id,
            entity_type="trope",
            entity_id=story_id,
            action="reorder",
            before=before,
            after=after,
            label="Reorder tropes",
            actor_id=current_user.id,
            client_id=client_id,
        )
    db.commit()
    return [trope_out(tropes[tid], db) for tid in body.ids]


@router.post("/tropes/{trope_id}/links", response_model=TropeLinkOut, status_code=status.HTTP_201_CREATED)
def add_link(
    trope_id: str,
    body: TropeLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    trope = _verify_trope(trope_id, db, current_user)
    _check_target(db, trope.story_id, body)
    existing = (
        db.query(TropeLink)
        .filter(
            TropeLink.trope_id == trope.id,
            TropeLink.character_id == body.character_id,
            TropeLink.relationship_id == body.relationship_id,
            TropeLink.node_id == body.node_id,
        )
        .first()
    )
    if existing:
        return existing
    link = TropeLink(
        trope_id=trope.id,
        character_id=body.character_id,
        relationship_id=body.relationship_id,
        node_id=body.node_id,
        note=body.note,
    )
    db.add(link)
    db.flush()
    change_log.record_row_create(
        db,
        link,
        "trope_links",
        entity_type="trope_link",
        story_id=trope.story_id,
        label=f"Play {trope.name} in {link_target_name(link, db)}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(link)
    return link


@router.patch("/trope-links/{link_id}", response_model=TropeLinkOut)
def update_link(
    link_id: str,
    body: TropeLinkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    link, trope = _verify_link(link_id, db, current_user)
    data = {k: v for k, v in patch_fields(body, nullable=set()).items() if getattr(link, k) != v}
    if data:
        change_log.record_update(
            db,
            link,
            data,
            entity_type="trope_link",
            story_id=trope.story_id,
            label=f"Edit {{fields}} on {trope.name} in {link_target_name(link, db)}",
            actor_id=current_user.id,
            client_id=client_id,
        )
        for key, value in data.items():
            setattr(link, key, value)
        db.commit()
        db.refresh(link)
    return link


@router.delete("/trope-links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_link(
    link_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    link, trope = _verify_link(link_id, db, current_user)
    change_log.record_row_delete(
        db,
        link,
        "trope_links",
        entity_type="trope_link",
        story_id=trope.story_id,
        label=f"Take {trope.name} out of {link_target_name(link, db)}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(link)
    db.commit()


@router.get("/structure/{node_id}/tropes", response_model=list[TropeOut])
def tropes_for_scene(node_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The tropes that play in this scene."""
    node = db.get(StructureNode, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Scene not found")
    _verify_story(node.story_id, db, current_user)
    tropes = (
        db.query(Trope)
        .join(TropeLink, TropeLink.trope_id == Trope.id)
        .filter(TropeLink.node_id == node_id)
        .order_by(Trope.position.asc())
        .all()
    )
    return [trope_out(t, db) for t in tropes]


@router.get("/characters/{character_id}/tropes", response_model=list[TropeOut])
def tropes_for_character(
    character_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """The tropes this character carries, alone or in one of their relationships."""
    character = db.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    _verify_story(character.story_id, db, current_user)
    rel_ids = [
        r.id
        for r in db.query(CharacterRelationship)
        .filter(
            (CharacterRelationship.character_id == character_id)
            | (CharacterRelationship.related_character_id == character_id)
        )
        .all()
    ]
    tropes = (
        db.query(Trope)
        .join(TropeLink, TropeLink.trope_id == Trope.id)
        .filter((TropeLink.character_id == character_id) | (TropeLink.relationship_id.in_(rel_ids)))
        .order_by(Trope.position.asc())
        .distinct()
        .all()
    )
    return [trope_out(t, db) for t in tropes]
