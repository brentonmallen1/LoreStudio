"""The findings feed (doc 12 P3): read, dismiss, fix, and run the local checks.

Reading writes nothing. Dismissing is the author's word and goes in the change log, so it
can be undone. The one fix offered, a misspelt name, rewrites prose the way the other
bulk tools do: logged under Chronicle › Changes, not undoable here, because the editor's
own history owns prose.
"""

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.finding_dismissal import FindingDismissal
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.findings import Finding, FindingsCount, FindingsOut, FixResult
from ..services import change_log
from ..services.dialogue_service import sync_story_dialogue
from ..services.findings import all_findings, collect
from ..services.findings.fingerprint import content_hash
from ..services.findings.view import load_view
from ..services.nlp_runs import run_editorial_consistency, run_prose_analysis

router = APIRouter()


def _story(story_id: str, db: Session, user: User) -> Story:
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


def _finding(story: Story, fingerprint: str, db: Session) -> Finding:
    found, _ = all_findings(load_view(story, db), db)
    match = next((f for f in found if f.id == fingerprint), None)
    if match is None:
        raise HTTPException(status_code=404, detail="That finding is no longer there")
    return match


@router.get("/stories/{story_id}/findings", response_model=FindingsOut)
def list_findings(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return collect(_story(story_id, db, user), db)


@router.get("/stories/{story_id}/findings/count", response_model=FindingsCount)
def count_findings(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return FindingsCount(count=collect(_story(story_id, db, user), db).open_count)


@router.post("/stories/{story_id}/findings/run-local", response_model=FindingsOut)
def run_local_checks(story_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The spaCy checks over every written scene, logged like any analysis, then the feed."""
    story = _story(story_id, db, user)
    sync_story_dialogue(story_id, db)
    run_prose_analysis(story_id, user.id, db)
    run_editorial_consistency(story_id, user.id, db)
    db.commit()
    return collect(story, db)


@router.post("/stories/{story_id}/findings/{fingerprint}/dismiss", status_code=204)
def dismiss_finding(
    story_id: str,
    fingerprint: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """ "It's intended." Kept with the scene's hash, so editing the scene lifts it (D4)."""
    story = _story(story_id, db, user)
    finding = _finding(story, fingerprint, db)
    existing = (
        db.query(FindingDismissal)
        .filter(FindingDismissal.story_id == story_id, FindingDismissal.fingerprint == fingerprint)
        .first()
    )
    node = db.get(StructureNode, finding.anchor.node_id) if finding.anchor.node_id else None
    node_hash = content_hash(node.content) if node is not None else None
    if existing is not None:
        # A lapsed dismissal is renewed against the scene as it is now.
        existing.node_content_hash = node_hash
        db.commit()
        return
    row = FindingDismissal(
        id=str(uuid.uuid4()), story_id=story_id, fingerprint=fingerprint, node_content_hash=node_hash
    )
    db.add(row)
    db.flush()
    change_log.record_row_create(
        db,
        row,
        "finding_dismissals",
        entity_type="finding_dismissal",
        story_id=story_id,
        label=f"Dismiss “{finding.text[:60]}”",
        actor_id=user.id,
        client_id=client_id,
    )
    db.commit()


@router.delete("/stories/{story_id}/findings/{fingerprint}/dismiss", status_code=204)
def restore_finding(
    story_id: str,
    fingerprint: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    _story(story_id, db, user)
    row = (
        db.query(FindingDismissal)
        .filter(FindingDismissal.story_id == story_id, FindingDismissal.fingerprint == fingerprint)
        .first()
    )
    if row is None:
        return
    change_log.record_row_delete(
        db,
        row,
        "finding_dismissals",
        entity_type="finding_dismissal",
        story_id=story_id,
        label="Bring back a dismissed finding",
        actor_id=user.id,
        client_id=client_id,
    )
    db.delete(row)
    db.commit()


@router.post("/stories/{story_id}/findings/{fingerprint}/fix", response_model=FixResult)
def fix_finding(
    story_id: str,
    fingerprint: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: str | None = Depends(change_log.get_client_id),
):
    """Make the fix a finding offers. Only a misspelt name has one: every whole-word
    "Elenor" in that scene becomes "Eleanor"."""
    story = _story(story_id, db, user)
    finding = _finding(story, fingerprint, db)
    node = db.get(StructureNode, finding.anchor.node_id) if finding.anchor.node_id else None
    if finding.fix is None or node is None:
        raise HTTPException(status_code=422, detail="This finding has no fix to make")
    pattern = re.compile(rf"(?<![\w-]){re.escape(finding.fix.old)}(?![\w-])")
    content, replaced = pattern.subn(finding.fix.new, node.content or "")
    if replaced:
        change_log.rewrite_prose(
            db,
            node,
            content,
            label=f"Fix “{finding.fix.old}” → “{finding.fix.new}” in {node.title or 'a scene'}",
            batch_id=str(uuid.uuid4()),
            actor_id=user.id,
            client_id=client_id,
        )
        node.summary_stale = True
        db.commit()
    return FixResult(node_id=node.id, replaced=replaced)
