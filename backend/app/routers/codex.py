"""
Codex: the story's knowledge graph, and the author's corrections to it (doc 07).

Reading is cheap and open. Writing is deliberately narrow: the graph is a view over the
Lorebook, so the only thing an author edits here is what the derivation cannot know — who
was actually in a scene.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.codex import CodexEdge, CodexNode
from ..models.story import Story
from ..models.user import User
from ..services.codex.embeddings import DEFAULT_EMBED_MODEL, embed_base_url_for, embed_model_for, search_backend
from ..services.codex.index import build_chunks, embed_pending, index_stats
from ..services.codex.presence import derive_facts, derive_presence, set_presence
from ..services.codex.suggest import review, suggest_for_story
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


class CodexSettings(BaseModel):
    """What the author chooses about the index. Everything else is derived."""

    embed_model: str | None = None
    effective_embed_model: str = DEFAULT_EMBED_MODEL
    search_backend: str = "python"


class CodexSettingsUpdate(BaseModel):
    embed_model: str | None = None


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


@handler("codex-suggest")
async def _run_codex_suggest(job, db: Session, user: User, report) -> dict:
    """Read the manuscript scene by scene and propose what the derivation cannot see."""

    def should_stop() -> bool:
        db.refresh(job)
        return job.cancel_requested

    return await suggest_for_story(
        job.story_id or "",
        db,
        user,
        node_ids=job.params.get("node_ids") or None,
        should_stop=should_stop,
        on_progress=report,
    )


@handler("codex-index")
async def _run_codex_index(job, db: Session, user: User, report) -> dict:
    """
    Rebuild the passages and embed the ones that changed.

    Chunking first means the index is consistent even if the embedding half is stopped or
    the model is unreachable: the passages are there, without vectors, and the next run
    picks up exactly those.
    """

    def should_stop() -> bool:
        db.refresh(job)
        return job.cancel_requested

    story_id = job.story_id or ""
    built = build_chunks(story_id, db)
    model = job.params.get("embed_model") or embed_model_for(user)
    embedded = await embed_pending(
        story_id,
        db,
        model=model,
        base_url=embed_base_url_for(user),
        should_stop=should_stop,
        on_progress=report,
    )
    return {
        "chunks": built.chunks,
        "reused": built.reused,
        "removed": built.removed,
        "embedded": embedded.embedded,
        "model": model,
        **({"errors": embedded.errors} if embedded.errors else {}),
    }


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
                "overridden": node_key in edges and (edges[node_key].props or {}).get("basis") == "manual",
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


@router.get("/codex/settings", response_model=CodexSettings)
def get_codex_settings(user: User = Depends(get_current_user)):
    """The embedding model, and the truth about how search will actually run."""
    chosen = ((user.settings or {}).get("codex") or {}).get("embed_model")
    return CodexSettings(
        embed_model=chosen,
        effective_embed_model=chosen or DEFAULT_EMBED_MODEL,
        search_backend=search_backend(),
    )


@router.patch("/codex/settings", response_model=CodexSettings)
def update_codex_settings(
    body: CodexSettingsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Change the embedding model.

    Nothing is re-embedded here. Vectors record the model that made them and a search only
    compares like with like, so the old ones simply stop matching and the next index run
    replaces them — the author decides when to pay for that.
    """
    user_settings = dict(user.settings or {})
    codex = dict(user_settings.get("codex") or {})
    if body.embed_model:
        codex["embed_model"] = body.embed_model
    else:
        codex.pop("embed_model", None)
    user_settings["codex"] = codex
    user.settings = user_settings
    flag_modified(user, "settings")
    db.commit()
    return CodexSettings(
        embed_model=codex.get("embed_model"),
        effective_embed_model=codex.get("embed_model") or DEFAULT_EMBED_MODEL,
        search_backend=search_backend(),
    )


@router.get("/stories/{story_id}/codex/index")
def get_index_stats(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """How much of the story is indexed, with what, and how much room it takes."""
    _story_or_404(story_id, db, user)
    return {**index_stats(story_id, db), "effective_embed_model": embed_model_for(user)}


@router.post("/stories/{story_id}/codex/index", status_code=202)
def queue_index(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Queue a reindex. Unchanged passages keep their vectors, so this is usually quick."""
    story = _story_or_404(story_id, db, user)
    job = enqueue(
        db,
        kind="codex-index",
        user_id=user.id,
        story_id=story_id,
        label=f"Codex index — {story.title}",
        params={"embed_model": embed_model_for(user)},
    )
    return {"job_id": job.id}


class ReviewRequest(BaseModel):
    ids: list[str]


class SuggestionOut(BaseModel):
    id: str
    #: "presence" | "fact" — what confirming this would write into the Lorebook.
    kind: str
    #: What the proposal says, in one line.
    statement: str
    #: The words in the scene it was read from. The author checks a quote, not a claim.
    quote: str
    confidence: float
    scene_id: str | None = None
    scene_title: str = ""


def _suggestions(story_id: str, db: Session) -> list[SuggestionOut]:
    nodes = {n.id: n for n in db.query(CodexNode).filter(CodexNode.story_id == story_id)}
    out: list[SuggestionOut] = []

    for edge in db.query(CodexEdge).filter(
        CodexEdge.story_id == story_id,
        CodexEdge.source == "llm",
        CodexEdge.kind == "present_in",
        CodexEdge.confirmed_at.is_(None),
    ):
        character, scene = nodes.get(edge.src_id), nodes.get(edge.dst_id)
        if not character or not scene:
            continue
        out.append(
            SuggestionOut(
                id=edge.id,
                kind="presence",
                statement=f"{character.label} is present in this scene",
                quote=(edge.props or {}).get("quote", ""),
                confidence=edge.confidence,
                scene_id=scene.ref_id,
                scene_title=scene.label,
            )
        )

    established = {
        e.src_id: e
        for e in db.query(CodexEdge).filter(CodexEdge.story_id == story_id, CodexEdge.kind == "established_in")
    }
    for fact in db.query(CodexNode).filter(
        CodexNode.story_id == story_id, CodexNode.kind == "fact", CodexNode.source == "llm"
    ):
        scene = nodes.get(established[fact.id].dst_id) if fact.id in established else None
        out.append(
            SuggestionOut(
                id=fact.id,
                kind="fact",
                statement=fact.label,
                quote=(fact.props or {}).get("quote", ""),
                confidence=float((fact.props or {}).get("confidence", 0.5)),
                scene_id=scene.ref_id if scene else None,
                scene_title=scene.label if scene else "",
            )
        )
    out.sort(key=lambda s: (s.scene_title, -s.confidence))
    return out


@router.get("/stories/{story_id}/codex/suggestions", response_model=list[SuggestionOut])
def list_suggestions(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The review queue: everything the model proposed and the author has not answered."""
    _story_or_404(story_id, db, user)
    return _suggestions(story_id, db)


@router.post("/stories/{story_id}/codex/suggest", status_code=202)
def queue_suggest(
    story_id: str,
    node_ids: list[str] | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Queue the suggestion pass over the manuscript, or over particular scenes."""
    story = _story_or_404(story_id, db, user)
    job = enqueue(
        db,
        kind="codex-suggest",
        user_id=user.id,
        story_id=story_id,
        label=f"Codex suggestions — {story.title}",
        params={"node_ids": node_ids or []},
    )
    return {"job_id": job.id}


@router.post("/stories/{story_id}/codex/suggestions/confirm")
def confirm_suggestions(
    story_id: str,
    body: ReviewRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Accept proposals. Each one becomes a real authored row — a "who is here" answer or a
    reader-knowledge event — so the graph never holds the only copy of it.
    """
    _story_or_404(story_id, db, user)
    return review(story_id, db, body.ids, accept=True)


@router.post("/stories/{story_id}/codex/suggestions/reject")
def reject_suggestions(
    story_id: str,
    body: ReviewRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Discard proposals. A no is not a record worth keeping."""
    _story_or_404(story_id, db, user)
    return review(story_id, db, body.ids, accept=False)
