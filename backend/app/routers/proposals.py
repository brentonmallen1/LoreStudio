"""The Proposals inbox (doc 12 P5): what the app noticed, for the author to say yes or no to.

Reading writes nothing. A yes writes the authored row and records the change; a no removes
or marks what proposed it. "Look again" runs the local name scan now and, where the
Assistant may run, queues the Codex suggestion pass as a job.
"""

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.story import Story
from ..models.user import User
from ..schemas.proposals import ActRequest, ActResult, ProposalsCount, ProposalsOut
from ..services import change_log
from ..services.job_queue import enqueue
from ..services.nlp_runs import run_entity_scan
from ..services.proposals import collect, find
from ..services.proposals.act import CannotAct, act, decline

router = APIRouter()


def _story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _proposal(story_id: str, proposal_id: str, db: Session):
    p = find(story_id, db, proposal_id)
    if p is None:
        raise HTTPException(status_code=404, detail="That proposal is no longer there")
    return p


@router.get("/stories/{story_id}/proposals", response_model=ProposalsOut)
def list_proposals(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _story(story_id, db, user)
    return collect(story_id, db)


@router.get("/stories/{story_id}/proposals/count", response_model=ProposalsCount)
def count_proposals(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _story(story_id, db, user)
    return ProposalsCount(count=collect(story_id, db).count)


@router.post("/stories/{story_id}/proposals/refresh")
def look_again(
    story_id: str,
    ai: bool = Body(False, embed=True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    story = _story(story_id, db, user)
    run_entity_scan(story_id, user.id, db)
    db.commit()
    job_id = None
    if ai:
        job = enqueue(
            db,
            kind="codex-suggest",
            user_id=user.id,
            story_id=story_id,
            label=f"Codex suggestions: {story.title}",
            params={"node_ids": []},
        )
        job_id = job.id
    return {"job_id": job_id, **collect(story_id, db).model_dump(mode="json")}


@router.post("/stories/{story_id}/proposals/{proposal_id}/act", response_model=ActResult)
def act_on_proposal(
    story_id: str,
    proposal_id: str,
    body: ActRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _story(story_id, db, user)
    try:
        return act(story_id, _proposal(story_id, proposal_id, db), body.action, db, user.id, client_id)
    except CannotAct as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/stories/{story_id}/proposals/{proposal_id}/decline", status_code=204)
def decline_proposal(
    story_id: str,
    proposal_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _story(story_id, db, user)
    decline(story_id, _proposal(story_id, proposal_id, db), db, user.id, client_id)
