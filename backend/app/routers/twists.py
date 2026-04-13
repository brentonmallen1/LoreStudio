import uuid
from fastapi import APIRouter, Depends, HTTPException, Body, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.story import Story
from ..models.twist import Twist
from ..models.structure import StructureNode
from ..models.plot_thread import PlotThread
from ..models.character import Character
from ..schemas.twist import TwistCreate, TwistUpdate, TwistOut
from ..schemas.ai_responses import TwistAnalysisResponse, StructuredResult
from ..auth.dependencies import get_current_user
from ..services.llm.gateway import ai_gateway, AICallContext
from ..services.llm.prompts.twists import build_twist_analysis_prompt
from ..services.llm.prompts.twist_impact import TWIST_IMPACT_SYSTEM, build_twist_impact_prompt

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
    return (
        db.query(Twist)
        .filter(Twist.story_id == story_id)
        .order_by(Twist.created_at.asc())
        .all()
    )


@router.post("/stories/{story_id}/twists", response_model=TwistOut, status_code=status.HTTP_201_CREATED)
def create_twist(
    story_id: str,
    body: TwistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _verify_story(story_id, db, current_user)
    twist = Twist(story_id=story_id, **body.model_dump())
    db.add(twist)
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
):
    twist = _verify_twist(twist_id, db, current_user)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(twist, key, value)
    db.commit()
    db.refresh(twist)
    return twist


@router.delete("/twists/{twist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_twist(
    twist_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    twist = _verify_twist(twist_id, db, current_user)
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
    reveal_matches = (
        db.query(Twist)
        .filter(Twist.story_id == node.story_id, Twist.revealed_at_node_id == node_id)
        .all()
    )

    # Twists where this node appears in any clue
    clue_matches = (
        db.query(Twist)
        .filter(Twist.story_id == node.story_id)
        .all()
    )
    clue_matches = [
        t for t in clue_matches
        if any(c.get("node_id") == node_id for c in (t.clues or []))
        and t not in reveal_matches
    ]

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

    # Assemble clue scene context
    clue_scenes = []
    for clue in (twist.clues or []):
        scene_title = None
        scene_content = None
        if clue.get("node_id"):
            node = db.get(StructureNode, clue["node_id"])
            if node:
                scene_title = node.title
                scene_content = node.content or ""
        clue_scenes.append({
            "clue_id": clue.get("id", ""),
            "clue_text": clue.get("text", ""),
            "points_to": clue.get("points_to", "truth"),
            "subtlety": clue.get("subtlety", "moderate"),
            "scene_title": scene_title,
            "scene_content": scene_content,
        })

    # Reveal scene context
    reveal_scene = None
    if twist.revealed_at_node_id:
        node = db.get(StructureNode, twist.revealed_at_node_id)
        if node:
            reveal_scene = {"title": node.title, "content": node.content or ""}

    # Pass all leaf scenes so the LLM can suggest scene links for unlinked clues
    all_nodes = db.query(StructureNode).filter(StructureNode.story_id == twist.story_id).all()
    children_ids = {n.parent_id for n in all_nodes if n.parent_id}
    all_scenes_ref = [
        {"id": n.id, "title": n.title or "Untitled"}
        for n in all_nodes if n.id not in children_ids
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
        messages=[{"role": "user", "content": f"Please analyze the twist \"{twist.name}\"."}],
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

    threads = (
        db.query(PlotThread)
        .filter(PlotThread.story_id == twist.story_id)
        .all()
    )
    characters = (
        db.query(Character)
        .filter(Character.story_id == twist.story_id)
        .all()
    )
    all_nodes = (
        db.query(StructureNode)
        .filter(StructureNode.story_id == twist.story_id)
        .order_by(StructureNode.order.asc())
        .all()
    )
    child_ids = {n.parent_id for n in all_nodes if n.parent_id}
    scenes = [
        {"id": n.id, "title": n.title or "Untitled", "synopsis": n.synopsis or ""}
        for n in all_nodes
        if n.id not in child_ids
    ]

    feature_prompt = build_twist_impact_prompt(
        twist_name=twist.name,
        the_truth=twist.the_truth,
        the_misdirection=twist.the_misdirection,
        story_title=story.title,
        threads=[{"id": t.id, "name": t.name, "description": t.description} for t in threads],
        characters=[{"id": c.id, "name": c.name, "role": getattr(c, "role", "")} for c in characters],
        scenes=scenes,
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
        messages=[{"role": "user", "content": f"Analyze the downstream impact of the twist \"{twist.name}\"."}],
        feature_prompt=TWIST_IMPACT_SYSTEM,
        context=ctx,
        db=db,
        user=current_user,
    )


@router.patch("/twists/{twist_id}/clues/{clue_id}/link")
def link_clue_to_scene(
    twist_id: str,
    clue_id: str,
    scene_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Link a clue to a specific scene node (or unlink by passing empty string)."""
    twist = _verify_twist(twist_id, db, current_user)
    clues = list(twist.clues or [])
    scene_title = None
    if scene_id:
        node = db.get(StructureNode, scene_id)
        if node:
            scene_title = node.title
    for c in clues:
        if c.get("id") == clue_id:
            c["node_id"] = scene_id or None
            c["scene_title"] = scene_title
            break
    twist.clues = clues
    db.commit()
    db.refresh(twist)
    from ..schemas.twist import TwistOut
    return TwistOut.model_validate(twist)
