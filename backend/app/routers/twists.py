from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.character import Character
from ..models.plot_thread import PlotThread
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.twist import Twist, TwistClue
from ..models.user import User
from ..schemas.ai_responses import StructuredResult, TwistAnalysisResponse
from ..schemas.twist import TwistClueCreate, TwistClueOut, TwistClueUpdate, TwistCreate, TwistOut, TwistUpdate
from ..services import change_log
from ..services.llm.gateway import AICallContext, ai_gateway
from ..services.llm.prompts.twist_impact import build_twist_impact_prompt
from ..services.llm.prompts.twists import build_twist_analysis_prompt
from ..services.patching import check_nodes, patch_fields
from ..services.structure_order import order_of
from ..services.text_utils import prose_text

router = APIRouter()


def _verify_story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _verify_twist(twist_id: str, db: Session, user: User) -> Twist:
    twist = db.get(Twist, twist_id)
    if not twist:
        raise HTTPException(status_code=404, detail="Twist not found")
    _verify_story(twist.story_id, db, user)
    return twist


# ── CRUD ──────────────────────────────────────────────────────────────────────


@router.get("/stories/{story_id}/twists", response_model=list[TwistOut])
def list_twists(
    story_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story(story_id, db, current_user)
    return db.query(Twist).filter(Twist.story_id == story_id).order_by(Twist.created_at.asc()).all()


@router.post("/stories/{story_id}/twists", response_model=TwistOut, status_code=status.HTTP_201_CREATED)
def create_twist(
    story_id: str,
    body: TwistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _verify_story(story_id, db, current_user)
    check_nodes(db, story_id, body.model_dump(), ("revealed_at_node_id",))
    twist = Twist(story_id=story_id, **body.model_dump())
    db.add(twist)
    db.flush()
    change_log.record_row_create(
        db,
        twist,
        "twists",
        entity_type="twist",
        story_id=story_id,
        label=f"Add twist {twist.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(twist)
    return twist


@router.get("/twists/{twist_id}", response_model=TwistOut)
def get_twist(
    twist_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _verify_twist(twist_id, db, current_user)


@router.patch("/twists/{twist_id}", response_model=TwistOut)
def update_twist(
    twist_id: str,
    body: TwistUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    twist = _verify_twist(twist_id, db, current_user)
    data = patch_fields(body, nullable={"revealed_at_node_id"})
    check_nodes(db, twist.story_id, data, ("revealed_at_node_id",))
    change_log.record_update(
        db,
        twist,
        data,
        entity_type="twist",
        story_id=twist.story_id,
        label=f"Edit {{fields}} on twist {twist.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(twist, key, value)
    db.commit()
    db.refresh(twist)
    return twist


@router.delete("/twists/{twist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_twist(
    twist_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    twist = _verify_twist(twist_id, db, current_user)
    change_log.record(
        db,
        story_id=twist.story_id,
        entity_type="twist",
        entity_id=twist.id,
        action="delete",
        before=change_log.capture_twist(twist, db),
        after=None,
        label=f"Delete twist {twist.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(twist)
    db.commit()


# ── Scene linking helper ──────────────────────────────────────────────────────


@router.get("/structure/{node_id}/twists", response_model=list[TwistOut])
def twists_for_scene(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all twists that reference this scene (as a clue location or reveal scene)."""
    node = db.get(StructureNode, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    _verify_story(node.story_id, db, current_user)

    # Twists where this is the reveal scene
    reveal_matches = db.query(Twist).filter(Twist.story_id == node.story_id, Twist.revealed_at_node_id == node_id).all()

    # Twists with a clue planted here
    clue_matches = (
        db.query(Twist)
        .join(TwistClue, TwistClue.twist_id == Twist.id)
        .filter(Twist.story_id == node.story_id, TwistClue.node_id == node_id)
        .distinct()
        .all()
    )
    clue_matches = [t for t in clue_matches if t not in reveal_matches]

    return reveal_matches + clue_matches


# ── AI Analysis ───────────────────────────────────────────────────────────────


@router.post("/twists/{twist_id}/analyze", response_model=StructuredResult)
async def analyze_twist(
    twist_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Analyze a twist's clue quality, distribution, reveal effectiveness,
    and misdirection strength using structured AI output.
    """
    twist = _verify_twist(twist_id, db, current_user)
    story = db.get(Story, twist.story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    # Reading order, so each clue can say whether it lands before the reveal (doc 18: a clue
    # after the reveal is not a clue), and the scene list reads front to back.
    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == twist.story_id).all()
    order = order_of(all_nodes)
    by_id = {n.id: n for n in all_nodes}
    reveal_at = order.get(twist.revealed_at_node_id or "")

    clue_scenes = []
    for clue in twist.clues:
        scene_title = None
        scene_content = None
        placement = None
        node = by_id.get(clue.node_id or "")
        if node:
            scene_title = node.title
            scene_content = prose_text(node.content or "")
            if reveal_at is not None:
                at = order.get(node.id, 0)
                placement = (
                    "before the reveal"
                    if at < reveal_at
                    else "in the reveal scene"
                    if at == reveal_at
                    else "AFTER the reveal"
                )
        clue_scenes.append(
            {
                "clue_id": clue.id,
                "clue_text": clue.text,
                "quote": clue.quote,
                "points_to": clue.points_to,
                "subtlety": clue.subtlety,
                "scene_title": scene_title,
                "scene_content": scene_content,
                "placement": placement,
            }
        )

    # Reveal scene context
    reveal_scene = None
    if twist.revealed_at_node_id and (node := by_id.get(twist.revealed_at_node_id)):
        reveal_scene = {"title": node.title, "content": prose_text(node.content or "")}

    # Pass all leaf scenes so the LLM can suggest scene links for unlinked clues
    children_ids = {n.parent_id for n in all_nodes if n.parent_id}
    all_scenes_ref = [
        {"id": n.id, "title": n.title or "Untitled"}
        for n in sorted(all_nodes, key=lambda n: order.get(n.id, 0))
        if n.id not in children_ids
    ]

    feature_prompt = build_twist_analysis_prompt(
        twist=twist,
        clue_scenes=clue_scenes,
        reveal_scene=reveal_scene,
        story_title=story.title,
        all_scenes=all_scenes_ref,
    )

    ctx = AICallContext(
        feature="twist-analysis",
        user_id=current_user.id,
        story_id=twist.story_id,
        extra_metadata={"twist_id": twist_id},
        tags=["twist", "analysis", "user-initiated"],
    )

    return await ai_gateway.generate_structured(
        response_model=TwistAnalysisResponse,
        messages=[{"role": "user", "content": f'Please analyze the twist "{twist.name}".'}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


@router.post("/twists/{twist_id}/analyze-impact", response_model=StructuredResult)
async def analyze_twist_impact(
    twist_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyze downstream effects when a twist resolves: affected threads, arcs, scenes to review."""
    twist = _verify_twist(twist_id, db, current_user)
    story = db.get(Story, twist.story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    threads = db.query(PlotThread).filter(PlotThread.story_id == twist.story_id).all()
    characters = db.query(Character).filter(Character.story_id == twist.story_id).all()
    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == twist.story_id).all()
    order = order_of(all_nodes)
    titles = {n.id: n.title or "Untitled" for n in all_nodes}
    child_ids = {n.parent_id for n in all_nodes if n.parent_id}
    scenes = [
        {"id": n.id, "title": titles[n.id], "synopsis": n.synopsis or ""}
        for n in sorted(all_nodes, key=lambda n: order.get(n.id, 0))
        if n.id not in child_ids
    ]
    clues = [
        {"text": c.text, "points_to": c.points_to, "scene": titles.get(c.node_id or "")} for c in twist.clues if c.text
    ]

    feature_prompt = build_twist_impact_prompt(
        twist_name=twist.name,
        the_truth=twist.the_truth,
        the_misdirection=twist.the_misdirection,
        story_title=story.title,
        threads=[{"id": t.id, "name": t.name, "description": t.description} for t in threads],
        characters=[{"id": c.id, "name": c.name, "role": getattr(c, "role", "")} for c in characters],
        scenes=scenes,
        reveal=titles.get(twist.revealed_at_node_id or "", ""),
        clues=clues,
    )

    ctx = AICallContext(
        feature="twist-impact",
        user_id=current_user.id,
        story_id=twist.story_id,
        extra_metadata={"twist_id": twist_id},
        tags=["twist", "impact", "analysis", "user-initiated"],
    )

    from pydantic import BaseModel as PydanticBase

    class AffectedThread(PydanticBase):
        thread_id: str = ""
        thread_name: str
        impact: str

    class AffectedArc(PydanticBase):
        character_id: str = ""
        character_name: str
        arc_change: str

    class SceneReview(PydanticBase):
        node_id: str = ""
        scene_title: str
        reason: str

    class RippleEffect(PydanticBase):
        area: str
        description: str

    class TwistImpactResponse(PydanticBase):
        affected_threads: list[AffectedThread] = []
        affected_arcs: list[AffectedArc] = []
        scenes_to_review: list[SceneReview] = []
        loose_ends: list[str] = []
        ripple_effects: list[RippleEffect] = []
        overall_assessment: str = ""

    return await ai_gateway.generate_structured(
        response_model=TwistImpactResponse,
        messages=[{"role": "user", "content": f'Analyze the downstream impact of the twist "{twist.name}".'}],
        feature_prompt=feature_prompt,
        context=ctx,
        db=db,
        user=current_user,
    )


# ── Clues (doc 18 C1: rows, not a JSON list on the twist) ─────────────────────


def _scene_title(node_id: str | None, db: Session) -> str:
    node = db.get(StructureNode, node_id) if node_id else None
    return (node.title if node else None) or "Untitled"


def _verify_clue(clue_id: str, db: Session, user: User) -> TwistClue:
    clue = db.get(TwistClue, clue_id)
    if not clue:
        raise HTTPException(status_code=404, detail="Clue not found")
    _verify_twist(clue.twist_id, db, user)
    return clue


@router.post("/twists/{twist_id}/clues", response_model=TwistClueOut, status_code=status.HTTP_201_CREATED)
def create_clue(
    twist_id: str,
    body: TwistClueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    twist = _verify_twist(twist_id, db, current_user)
    check_nodes(db, twist.story_id, body.model_dump(), ("node_id",))
    position = max((c.position for c in twist.clues), default=-1) + 1
    clue = TwistClue(twist_id=twist.id, position=position, **body.model_dump())
    db.add(clue)
    db.flush()
    where = f" in “{_scene_title(clue.node_id, db)}”" if clue.node_id else ""
    change_log.record_row_create(
        db,
        clue,
        "twist_clues",
        entity_type="twist_clue",
        story_id=twist.story_id,
        label=f"Plant a clue for {twist.name}{where}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.commit()
    db.refresh(clue)
    return clue


@router.patch("/twist-clues/{clue_id}", response_model=TwistClueOut)
def update_clue(
    clue_id: str,
    body: TwistClueUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    clue = _verify_clue(clue_id, db, current_user)
    twist = clue.twist
    data = {k: v for k, v in patch_fields(body, nullable={"node_id"}).items() if getattr(clue, k) != v}
    check_nodes(db, twist.story_id, data, ("node_id",))
    if data:
        change_log.record_update(
            db,
            clue,
            data,
            entity_type="twist_clue",
            story_id=twist.story_id,
            label=f"Edit {{fields}} on a clue for {twist.name}",
            actor_id=current_user.id,
            client_id=client_id,
        )
        for key, value in data.items():
            setattr(clue, key, value)
        db.commit()
        db.refresh(clue)
    return clue


@router.delete("/twist-clues/{clue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clue(
    clue_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    clue = _verify_clue(clue_id, db, current_user)
    change_log.record_row_delete(
        db,
        clue,
        "twist_clues",
        entity_type="twist_clue",
        story_id=clue.twist.story_id,
        label=f"Delete a clue for {clue.twist.name}",
        actor_id=current_user.id,
        client_id=client_id,
    )
    db.delete(clue)
    db.commit()
