"""Scene takes (doc 29 D7): try another version of a scene, switch between its takes, choose the
one that counts, rename and delete them. Each is one change ⌘Z takes back; typing in a take is
the editor's own history, as typing in a scene is. Every answer is the scene's takes as they now
stand."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.scene_take import SceneTake
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.takes import TakeOut, TakeRename, TakesOut, TakeWrite
from ..services import change_log, takes
from ..services.dialogue_service import sync_scene_dialogue, take_lines
from ..services.edit_conflict import refuse_if_changed
from .dialogue import DialogueBlockOut

router = APIRouter()


def _node(node_id: str, db: Session, user: User) -> StructureNode:
    node = db.get(StructureNode, node_id)
    if node is None or db.query(Story).filter(Story.id == node.story_id, Story.user_id == user.id).first() is None:
        raise HTTPException(status_code=404, detail="Scene not found")
    return node


def _take(take_id: str, db: Session, user: User) -> tuple[StructureNode, SceneTake]:
    take = db.get(SceneTake, take_id)
    if take is None:
        raise HTTPException(status_code=404, detail="Take not found")
    return _node(take.node_id, db, user), take


def _one(node: StructureNode, t: SceneTake, number: int) -> TakeOut:
    content, words = takes.text_of(node, t)
    return TakeOut(
        id=t.id,
        node_id=node.id,
        number=number,
        label=t.label or "",
        content=content,
        word_count=words,
        counts=t.counts,
        is_open=t.is_open,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )  # fmt: skip


def _out(db: Session, node: StructureNode) -> TakesOut:
    return TakesOut(node_id=node.id, takes=[_one(node, t, i + 1) for i, t in enumerate(takes.takes_of(db, node))])


def _done(db: Session, node: StructureNode) -> TakesOut:
    db.commit()
    db.refresh(node)
    return _out(db, node)


@router.get("/structure/{node_id}/takes", response_model=TakesOut)
def list_takes(node_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _out(db, _node(node_id, db, user))


@router.post("/structure/{node_id}/takes", response_model=TakesOut, status_code=201)
def try_another_version(
    node_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """A copy of the open take (the scene's prose, the first time) as a new take, opened."""
    node = _node(node_id, db, user)
    takes.try_another(db, node, actor_id=user.id, client_id=client_id)
    return _done(db, node)


@router.post("/takes/{take_id}/open", response_model=TakesOut)
def switch_to_take(
    take_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    node, take = _take(take_id, db, user)
    takes.open_take(db, node, take, actor_id=user.id, client_id=client_id)
    return _done(db, node)


@router.post("/takes/{take_id}/use", response_model=TakesOut)
def use_take(
    take_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Make this take the one that counts: its words become the scene's prose."""
    node, take = _take(take_id, db, user)
    try:
        takes.use_take(db, node, take, actor_id=user.id, client_id=client_id)
    except takes.TakeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    out = _done(db, node)
    sync_scene_dialogue(node, db)
    return out


@router.patch("/takes/{take_id}", response_model=TakesOut)
def rename_take(
    take_id: str,
    body: TakeRename,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    node, take = _take(take_id, db, user)
    takes.rename_take(db, node, take, body.label, actor_id=user.id, client_id=client_id)
    return _done(db, node)


@router.put("/takes/{take_id}/content", response_model=TakeOut)
def write_take(
    take_id: str,
    body: TakeWrite,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Autosave for a take that does not count (the one that counts saves as the scene). A take
    changed since the editor loaded it answers 409, as a scene's save does."""
    node, take = _take(take_id, db, user)

    def current() -> dict:
        number = next(i + 1 for i, t in enumerate(takes.takes_of(db, node)) if t.id == take.id)
        return _one(node, take, number).model_dump(mode="json")

    refuse_if_changed(
        body.expected_updated_at,
        take.updated_at,
        message="This take changed since you loaded it.",
        key="take",
        current=current,
    )
    try:
        takes.write(db, node, take, body.content, body.word_count, actor_id=user.id, client_id=client_id)
    except takes.TakeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return next(t for t in _done(db, node).takes if t.id == take.id)


@router.get("/takes/{take_id}/dialogue", response_model=list[DialogueBlockOut])
def take_dialogue(take_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Who says each line of the take, for the editor's dialogue colors: the scene's own lines for
    the take that counts, else read from the take's words and not stored."""
    node, take = _take(take_id, db, user)
    if take.counts:
        return sync_scene_dialogue(node, db)
    return [
        DialogueBlockOut(
            **{**line, "speaker_name": line.get("speaker_name") or ""},
            id=f"{take.id}:{i}",
            scene_id=node.id,
            subtext=None,
        )
        for i, line in enumerate(take_lines(node, take.content or "", db))
    ]


@router.delete("/takes/{take_id}", response_model=TakesOut)
def delete_take(
    take_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    node, take = _take(take_id, db, user)
    try:
        takes.delete_take(db, node, take, actor_id=user.id, client_id=client_id)
    except takes.TakeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return _done(db, node)
