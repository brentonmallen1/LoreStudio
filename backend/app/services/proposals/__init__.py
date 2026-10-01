"""The Proposals inbox (doc 12 P5): gather, decline, act.

``gather`` reads every source in ``sources.py`` and leaves out what the author declined.
A decline of a scene-bound proposal (dialogue with no speaker) lapses when the scene
changes, as a dismissed finding does (D4): new lines are a new question.
"""

from __future__ import annotations

from collections import Counter

from sqlalchemy.orm import Session

from ...models.proposal_decline import ProposalDecline
from ...schemas.proposals import Proposal, ProposalsOut
from ..findings.runs import latest_runs
from .sources import SOURCES, reading_order, scene_hashes, scene_titles

#: Writer mode shows no Assistant: these sources are hidden there.
AI_SOURCES = {"ai"}


def gather(story_id: str, db: Session, *, include_ai: bool = True) -> list[Proposal]:
    titles = scene_titles(story_id, db)
    found: list[Proposal] = []
    for source in SOURCES:
        found += source(story_id, db, titles)
    declines = {d.fingerprint: d for d in db.query(ProposalDecline).filter(ProposalDecline.story_id == story_id)}
    hashes = scene_hashes(story_id, db) if declines else {}

    def declined(p: Proposal) -> bool:
        d = declines.get(p.id)
        if d is None:
            return False
        return d.node_content_hash is None or hashes.get(p.node_id or "") == d.node_content_hash

    order = reading_order(story_id, db)
    kept = [p for p in found if not declined(p) and (include_ai or p.source not in AI_SOURCES)]
    return sorted(kept, key=lambda p: (order.get(p.node_id or "", len(order)), p.text))


def collect(story_id: str, db: Session, *, include_ai: bool = True) -> ProposalsOut:
    proposals = gather(story_id, db, include_ai=include_ai)
    scan = latest_runs(story_id, db).get("entity-suggestions")
    return ProposalsOut(
        proposals=proposals,
        counts_by_kind=dict(Counter(p.kind for p in proposals)),
        count=len(proposals),
        last_scan=scan.created_at if scan else None,
    )


def find(story_id: str, db: Session, proposal_id: str) -> Proposal | None:
    return next((p for p in gather(story_id, db) if p.id == proposal_id), None)
