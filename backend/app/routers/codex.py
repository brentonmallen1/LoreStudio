"""
Codex: the story's knowledge graph, and the author's corrections to it (doc 07).

Reading is cheap and open. Writing is deliberately narrow: the graph is a view over the
Lorebook, so the only thing an author edits here is what the derivation cannot know — who
was actually in a scene.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.codex import CodexEdge, CodexNode
from ..models.story import Story
from ..models.user import User
from ..services.codex.presence import derive_facts, derive_presence, set_presence
from ..services.codex.sync import sync_story
from ..services.job_queue import enqueue, handler

router = APIRouter()

#: What the author may say about a character in a scene.
PRESENCE_ROLES = ("pov", "participant", "mentioned", "absent")


class NodeOut(BaseModel):
    id: str
    kind: str
    label: str
    summary: str
    ref_id: str
    props: dict

    model_config = {"from_attributes": True}


class EdgeOut(BaseModel):
    id: str
    kind: str
    src_id: str
    dst_id: str
    props: dict
    source: str
    confidence: float

    model_config = {"from_attributes": True}


class GraphOut(BaseModel):
    nodes: list[NodeOut]
    edges: list[EdgeOut]
    counts: dict[str, int]


class PresenceUpdate(BaseModel):
    character_id: str
    node_id: str
    #: pov | participant | mentioned | absent
    role: str


@handler("codex-sync")
async def _run_codex_sync(job, db: Session, user: User, report) -> dict:
    """Rebuild one story's graph. Deterministic, so it can run whenever."""
    result = sync_story(job.story_id or "", db)
    report(1, 1)
    return {"nodes": result.nodes, "edges": result.edges, **result.by_kind}


def _story_or_404(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.get("/stories/{story_id}/codex", response_model=GraphOut)
def get_graph(
    story_id: str,
    kind: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """The graph, optionally one kind of node at a time."""
    _story_or_404(story_id, db, user)
    nodes_q = db.query(CodexNode).filter(CodexNode.story_id == story_id)
    if kind:
        nodes_q = nodes_q.filter(CodexNode.kind == kind)
    nodes = nodes_q.all()
    node_ids = {n.id for n in nodes}
    edges = [
        e
        for e in db.query(CodexEdge).filter(CodexEdge.story_id == story_id)
        if e.src_id in node_ids and e.dst_id in node_ids
    ]
    counts: dict[str, int] = {}
    for node in nodes:
        counts[node.kind] = counts.get(node.kind, 0) + 1
    for edge in edges:
        counts[edge.kind] = counts.get(edge.kind, 0) + 1
    return GraphOut(nodes=nodes, edges=edges, counts=counts)


@router.post("/stories/{story_id}/codex/sync", status_code=202)
def queue_sync(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Queue a rebuild. It is deterministic, so running it again is always safe."""
    story = _story_or_404(story_id, db, user)
    job = enqueue(
        db,
        kind="codex-sync",
        user_id=user.id,
        story_id=story_id,
        label=f"Codex sync — {story.title}",
    )
    return {"job_id": job.id}


@router.get("/stories/{story_id}/codex/presence/{node_id}")
def get_scene_presence(
    story_id: str,
    node_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Who the graph thinks is in this scene, and why — the "Who is here" panel."""
    _story_or_404(story_id, db, user)
    scene = (
        db.query(CodexNode)
        .filter(CodexNode.story_id == story_id, CodexNode.kind == "scene", CodexNode.ref_id == node_id)
        .one_or_none()
    )
    if not scene:
        return {"synced": False, "characters": []}

    characters = {
        n.id: n for n in db.query(CodexNode).filter(CodexNode.story_id == story_id, CodexNode.kind == "character")
    }
    edges = {
        e.src_id: e
        for e in db.query(CodexEdge).filter(
            CodexEdge.story_id == story_id, CodexEdge.kind == "present_in", CodexEdge.dst_id == scene.id
        )
    }
    return {
        "synced": True,
        "characters": [
            {
                "character_id": node.ref_id,
                "name": node.label,
                "role": (edges[node_key].props or {}).get("role") if node_key in edges else "absent",
                "basis": (edges[node_key].props or {}).get("basis") if node_key in edges else None,
                "overridden": node_key in edges and edges[node_key].source == "override",
            }
            for node_key, node in characters.items()
        ],
    }


@router.post("/stories/{story_id}/codex/presence")
def update_scene_presence(
    story_id: str,
    body: PresenceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    The author's answer about one character in one scene. Recorded as an override, so no
    rebuild argues with it, and used by interviews from then on.
    """
    _story_or_404(story_id, db, user)
    if body.role not in PRESENCE_ROLES:
        raise HTTPException(status_code=422, detail=f"role must be one of {PRESENCE_ROLES}")

    row = set_presence(body.node_id, body.character_id, body.role, db)
    # The answer changes what interviews are told, so the graph catches up immediately
    # rather than waiting for the next sync.
    derive_presence(story_id, db)
    derive_facts(story_id, db)
    return {"role": row.role, "source": "author"}
