"""The findings feed (doc 12 P3): everything that needs the author's eye, in one list.

``collect`` reads three sources and subtracts what the author has dismissed:

- local checks (``local.py``): name drift and unknown speakers on every read, the spaCy
  checks from their latest run;
- data checks (``data.py``): absences, thread shape, empty chapters, the word target, and the
  promise checks the tapestry shows (a quiet thread, a clue after its reveal, ...);
- Assistant runs (``ai.py``): read from the Chronicle's latest run of each check;
- series checks (``series.py``): books of a series that disagree about what stays true, and
  threads that run across books (left open, opened again, crossing).

Nothing here writes. A dismissal lapses when its scene changes (D4).
"""

from __future__ import annotations

from collections import Counter

from sqlalchemy.orm import Session

from ...models.finding_dismissal import FindingDismissal
from ...models.story import Story
from ...schemas.findings import Finding, FindingsOut
from ..promises import promises_view
from ..series.promises import SeriesPromises
from . import ai, data, local, series
from .fingerprint import content_hash
from .runs import latest_runs
from .view import StoryView, load_view

_SEVERITY_ORDER = {"high": 0, "mid": 1, "low": 2}


def all_findings(view: StoryView, db: Session) -> tuple[list[Finding], dict]:
    """Every finding before dismissals, and the latest run of each check."""
    runs = latest_runs(view.story.id, db)
    found = local.computed(view, db) + data.computed(view)
    # A book of a series is read with its neighbours once, for its promises and the series checks.
    sp = SeriesPromises.for_story(db, view.story.id)
    ctx = sp.book(view.story.id) if sp else None
    found += data.promise_findings(promises_view(view.story.id, db, ctx) if ctx else promises_view(view.story.id, db))
    found += series.computed(view, db, ctx)
    if "prose-analysis" in runs:
        found += local.from_prose_run(view, runs["prose-analysis"])
    if "editorial-consistency" in runs:
        found += local.from_editorial_run(view, runs["editorial-consistency"])
    for feature, log in runs.items():
        found += ai.to_findings(view, feature, log)
    unique: dict[str, Finding] = {}
    for f in found:
        unique.setdefault(f.id, f)
    return list(unique.values()), runs


def is_dismissed(f: Finding, dismissals: dict[str, FindingDismissal], view: StoryView) -> bool:
    d = dismissals.get(f.id)
    if d is None:
        return False
    if d.node_content_hash is None:
        return True
    node = view.by_id.get(f.anchor.node_id or "")
    return node is not None and content_hash(node.content) == d.node_content_hash


def _reading_order(view: StoryView):
    position = {n.id: i for i, n in enumerate(view.ordered)}

    def key(f: Finding):
        return (position.get(f.anchor.node_id or "", len(position)), _SEVERITY_ORDER[f.severity], f.text)

    return key


def collect(story: Story, db: Session) -> FindingsOut:
    view = load_view(story, db)
    found, runs = all_findings(view, db)
    dismissals = {d.fingerprint: d for d in db.query(FindingDismissal).filter(FindingDismissal.story_id == story.id)}
    open_ = sorted((f for f in found if not is_dismissed(f, dismissals, view)), key=_reading_order(view))
    local_runs = [runs[f].created_at for f in local.LOCAL_FEATURES if f in runs]
    return FindingsOut(
        findings=open_,
        counts_by_kind=dict(Counter(f.kind for f in open_)),
        open_count=len(open_),
        dismissed_count=len(found) - len(open_),
        last_local_run=max(local_runs) if local_runs else None,
        last_ai_run_by_feature={f: log.created_at for f, log in runs.items() if ai.is_check(f)},
        sizing=view.sizing,
    )
