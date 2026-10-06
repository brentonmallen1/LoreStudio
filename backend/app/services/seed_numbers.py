"""
The Numbers history of "The Last Lighthouse" (doc 19): a few weeks of readings, so Compare has
something to show on a new install.

A reading is the page's figures, so the history is the demo measured as it is, then walked back:
a first draft of the first four chapters, sessions as the book grew, a version saved before the
storm chapters were rewritten, and yesterday's session. Two versions keep their names (First
draft, Before the storm rewrite), as a named snapshot's reading would.
"""

from __future__ import annotations

import copy
from datetime import UTC, datetime, timedelta
from statistics import median
from typing import Any

from sqlalchemy.orm import Session

from ..models.numbers_reading import NumbersReading
from ..models.story import Story
from .numbers_reading import READING_VERSION, measure_now
from .word_count import get_word_count_status


def _by_name(items: list[dict], name: str) -> str | None:
    return next((i["id"] for i in items if i["name"].startswith(name)), None)


def _earlier(
    now: dict[str, Any],
    *,
    at: datetime,
    chapters: int,
    scale: float,
    drafts: bool = False,
    absent: dict[str, set[int] | None] | None = None,
    open_threads: tuple[str, ...] = (),
    missing_threads: tuple[str, ...] = (),
    longer: dict[int, float] | None = None,
    balance: int,
    prose: tuple[float, float, float],
    findings_extra: int,
) -> dict[str, Any]:
    """The demo as it stood at `at`: fewer chapters, shorter scenes, a thread still open."""
    d = copy.deepcopy(now)
    keep = [c["id"] for c in d["chapters"][:chapters]]
    d["chapters"] = d["chapters"][:chapters]
    d["scenes"] = [s for s in d["scenes"] if s["parent_id"] in keep]
    gone = {_by_name(d["threads"], t) for t in missing_threads}
    d["threads"] = [t for t in d["threads"] if t["id"] not in gone]
    for t in d["threads"]:
        if any(t["name"].startswith(o) for o in open_threads):
            t["status"] = "open"
    for i, s in enumerate(d["scenes"]):
        s["words"] = round(s["words"] * scale * (longer or {}).get(i, 1.0))
        if drafts and s["words"]:
            s["status"] = "draft"
        s["threads"] = [a for a in s["threads"] if a["id"] not in gone]
        for name, where in (absent or {}).items():
            cid = _by_name(d["characters"], name)
            if cid and (where is None or i in where):
                s["characters"] = [c for c in s["characters"] if c != cid]

    words = [s["words"] for s in d["scenes"]]
    written = [w for w in words if w]
    by_status = dict.fromkeys(("final", "revised", "draft", "planned"), 0)
    for s in d["scenes"]:
        by_status[s["status"]] = by_status.get(s["status"], 0) + s["words"]
    d["words"].update(
        total=sum(words),
        by_status=by_status,
        scenes=len(words),
        written_scenes=len(written),
        mean_per_scene=round(sum(written) / len(written)) if written else 0,
        median_per_scene=round(median(written)) if written else 0,
        target=get_word_count_status(d["words"]["form"], sum(words)),
        reads_as=None,
    )

    share = len(d["scenes"]) / max(1, len(now["scenes"]))
    dia = d["dialogue"]
    dia["total_lines"] = round(dia["total_lines"] * share * scale)
    dia["balance"] = balance
    for sp in dia["speakers"]:
        sp["line_count"] = round(sp["line_count"] * share)
        sp["word_count"] = round(sp["word_count"] * share * scale)
    dia["speakers"] = [sp for sp in dia["speakers"] if sp["word_count"] > 0]

    if d.get("prose"):
        passive, adverbs, mean_sentence = prose
        ids = {s["id"] for s in d["scenes"] if s["words"]}
        d["prose"].update(
            run_id=f"seed-{at.date().isoformat()}",
            run_at=at.isoformat(),
            scenes=len(ids),
            passive_pct=passive,
            adverb_pct=adverbs,
            mean_sentence=mean_sentence,
            sentence_lengths=[
                {**b, "count": round(b["count"] * share * (1.25 if i >= 2 else 0.85))}
                for i, b in enumerate(d["prose"]["sentence_lengths"])
            ],
            by_scene=[b for b in d["prose"]["by_scene"] if b["scene_id"] in ids],
        )
    if d.get("findings"):
        d["findings"] = {k: v + findings_extra for k, v in d["findings"].items()}
    d["summaries"] = {"fresh": 0, "stale": 0, "missing": len(written)}
    return d


def seed_lighthouse_numbers(db: Session, story: Story) -> None:
    """Weeks of readings for the demo, oldest first. Skipped if it has any already."""
    if db.query(NumbersReading).filter(NumbersReading.story_id == story.id).first():
        return
    now = measure_now(story, db)
    today = datetime.now(UTC).replace(tzinfo=None)
    history: list[tuple[int, str, str | None, dict[str, Any]]] = [
        # (days ago, trigger, version name, how the book stood)
        (
            24,
            "snapshot",
            "First draft",
            dict(
                chapters=4,
                scale=0.55,
                drafts=True,
                absent={"Margaret": None},
                open_threads=("The Missing", "Eleanor", "The Visitor"),
                missing_threads=("Staying",),
                balance=61,
                prose=(4.3, 0.7, 10.4),
                findings_extra=2,
            ),
        ),
        (
            17,
            "session",
            None,
            dict(
                chapters=5,
                scale=0.7,
                drafts=True,
                absent={"Margaret": None},
                open_threads=("The Missing", "Eleanor"),
                missing_threads=("Staying",),
                balance=68,
                prose=(3.8, 0.6, 9.8),
                findings_extra=2,
            ),
        ),
        (
            6,
            "snapshot",
            "Before the storm rewrite",
            dict(
                chapters=7,
                scale=0.92,
                absent={"Thomas": {5}},
                open_threads=("Eleanor",),
                longer={6: 1.35, 7: 1.2},
                balance=76,
                prose=(3.0, 0.4, 9.1),
                findings_extra=1,
            ),
        ),
        (
            1,
            "session",
            None,
            dict(chapters=7, scale=0.98, balance=80, prose=(2.6, 0.3, 8.8), findings_extra=0),
        ),
    ]
    for days, trigger, label, how in history:
        at = today - timedelta(days=days, hours=2)
        db.add(
            NumbersReading(
                story_id=story.id,
                taken_at=at,
                trigger=trigger,
                label=label,
                version=READING_VERSION,
                data=_earlier(now, at=at, **how),
            )
        )
    db.commit()
