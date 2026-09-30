from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.todo import StoryTodo
from ..models.user import User
from ..schemas.todo import ReorderPayload, TodoCreate, TodoOut, TodoUpdate
from ..services import change_log

router = APIRouter()


def _verify_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_todo(todo_id: str, db: Session, user: User) -> StoryTodo:
    todo = db.get(StoryTodo, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    _verify_story(todo.story_id, db, user)
    return todo


def _noun(todo: StoryTodo) -> str:
    return "question" if todo.kind == "question" else "TODO"


def _serialize(todo: StoryTodo) -> TodoOut:
    return TodoOut(
        id=todo.id,
        story_id=todo.story_id,
        node_id=todo.node_id,
        content=todo.content,
        kind=todo.kind,
        about_type=todo.about_type,
        about_id=todo.about_id,
        answer=todo.answer or "",
        done=todo.done,
        position=todo.position,
        doc_from=todo.doc_from,
        doc_to=todo.doc_to,
        created_at=todo.created_at,
        updated_at=todo.updated_at,
        node_title=todo.node.title if todo.node else None,
    )


# ── List / Create ─────────────────────────────────────────────────────────────


@router.get("/stories/{story_id}/todos", response_model=list[TodoOut])
def list_todos(
    story_id: str,
    kind: Literal["todo", "question"] = "todo",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story(story_id, db, current_user)
    todos = (
        db.query(StoryTodo)
        .filter(StoryTodo.story_id == story_id, StoryTodo.kind == kind)
        .order_by(StoryTodo.position.asc(), StoryTodo.created_at.asc())
        .all()
    )
    return [_serialize(t) for t in todos]


@router.post(
    "/stories/{story_id}/todos",
    response_model=TodoOut,
    status_code=status.HTTP_201_CREATED,
)
def create_todo(
    story_id: str,
    body: TodoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _verify_story(story_id, db, current_user)

    # Assign next position within the story
    max_pos = (
        db.query(StoryTodo.position).filter(StoryTodo.story_id == story_id).order_by(StoryTodo.position.desc()).first()
    )
    next_pos = (max_pos[0] + 1) if max_pos else 0

    todo = StoryTodo(
        story_id=story_id,
        position=next_pos,
        **body.model_dump(exclude={"position"}),
    )
    db.add(todo)
    db.flush()
    change_log.record_row_create(
        db,
        todo,
        "story_todos",
        entity_type="todo",
        story_id=story_id,
        label=f"Add {_noun(todo)} “{(todo.content or '')[:40]}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(todo)
    return _serialize(todo)


# ── Scene-scoped list ─────────────────────────────────────────────────────────


@router.get("/structure/{node_id}/todos", response_model=list[TodoOut])
def todos_for_scene(
    node_id: str,
    kind: Literal["todo", "question"] = "todo",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    node = db.get(StructureNode, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    _verify_story(node.story_id, db, current_user)
    todos = (
        db.query(StoryTodo)
        .filter(StoryTodo.node_id == node_id, StoryTodo.kind == kind)
        .order_by(StoryTodo.position.asc(), StoryTodo.created_at.asc())
        .all()
    )
    return [_serialize(t) for t in todos]


# ── Single CRUD ───────────────────────────────────────────────────────────────


@router.get("/todos/{todo_id}", response_model=TodoOut)
def get_todo(
    todo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    todo = _verify_todo(todo_id, db, current_user)
    return _serialize(todo)


@router.patch("/todos/{todo_id}", response_model=TodoOut)
def update_todo(
    todo_id: str,
    body: TodoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    todo = _verify_todo(todo_id, db, current_user)
    data = body.model_dump(exclude_none=True)
    change_log.record_update(
        db,
        todo,
        data,
        entity_type="todo",
        story_id=todo.story_id,
        label=f"Edit {_noun(todo)} “{(todo.content or '')[:40]}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(todo, key, value)
    db.commit()
    db.refresh(todo)
    return _serialize(todo)


@router.delete("/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(
    todo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    todo = _verify_todo(todo_id, db, current_user)
    change_log.record_row_delete(
        db,
        todo,
        "story_todos",
        entity_type="todo",
        story_id=todo.story_id,
        label=f"Delete {_noun(todo)} “{(todo.content or '')[:40]}”",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(todo)
    db.commit()


# ── Bulk operations ───────────────────────────────────────────────────────────


@router.post("/stories/{story_id}/todos/reorder", response_model=list[TodoOut])
def reorder_todos(
    story_id: str,
    body: ReorderPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _verify_story(story_id, db, current_user)
    before = change_log.reorder_snapshot(StoryTodo, list(body.todo_ids), db)
    for idx, todo_id in enumerate(body.todo_ids):
        todo = db.get(StoryTodo, todo_id)
        if todo and todo.story_id == story_id:
            todo.position = idx
    db.flush()
    after = change_log.reorder_snapshot(StoryTodo, list(body.todo_ids), db)
    if before != after:
        change_log.record(
            db,
            story_id=story_id,
            entity_type="todo",
            entity_id=story_id,
            action="reorder",
            before=before,
            after=after,
            label="Reorder TODOs",
            actor_id=current_user.id,
            client_id=client_id,
        )
    db.commit()
    todos = (
        db.query(StoryTodo)
        .filter(StoryTodo.story_id == story_id)
        .order_by(StoryTodo.position.asc(), StoryTodo.created_at.asc())
        .all()
    )
    return [_serialize(t) for t in todos]


@router.delete(
    "/stories/{story_id}/todos/done",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_done_todos(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story(story_id, db, current_user)
    db.query(StoryTodo).filter(
        StoryTodo.story_id == story_id,
        StoryTodo.kind == "todo",
        StoryTodo.done == True,  # noqa: E712
    ).delete()
    db.commit()
