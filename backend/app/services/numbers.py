"""The story in numbers (doc 13 P3).

Story Health had these as cards; they went with it in Stage 8 and came back as a page of
their own. Everything is computed on read from the story's rows and the latest local prose
run; nothing here is stored. The per-scene charts (pacing, thread lanes, who is in which
scene) are drawn in the browser from ``/scene-cast``, which already has every field.
"""

from __future__ import annotations

from statistics import median

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models.dialogue import DialogueBlock
from ..models.story import Story
from ..schemas.numbers import (
    MonologueScene,
    NumbersDialogue,
    NumbersOut,
    NumbersProse,
    NumbersSummaries,
    NumbersWords,
    ProseScene,
    SentenceBucket,
    SpeakerPair,
    SpeakerShare,
    WordTarget,
)
from .dialogue_service import get_interaction_matrix, gini, sync_story_dialogue
from .findings.runs import latest_runs, result_of
from .findings.view import StoryView, load_view
from .word_count import WORD_COUNT_RANGES, get_word_count_status

STATUSES = ("planned", "draft", "revised", "final")
CONTAINERS = ("act", "part", "chapter", "book")


def form_for(words: int) -> str | None:
    """The bounded form a length falls in (the last form with no upper bound past that)."""
    for form, r in WORD_COUNT_RANGES.items():
        if r["min"] is None:
            continue
        if r["max"] is None or words < r["max"]:
            return form if words >= r["min"] else None
    return None


def words(view: StoryView) -> NumbersWords:
    # An empty chapter is a leaf of the tree, but not a scene.
    leaves = [n for n in view.leaves if (n.level_type or "").lower() not in CONTAINERS]
    by_status = dict.fromkeys(STATUSES, 0)
    for n in leaves:
        by_status[n.status or "draft"] = by_status.get(n.status or "draft", 0) + (n.word_count or 0)
    written = [n.word_count or 0 for n in leaves if (n.word_count or 0) > 0]
    total = sum(n.word_count or 0 for n in leaves)
    form = view.story.intended_length or ""
    target = get_word_count_status(form, total)
    # Only past the form's ceiling: a novel at 5,000 words is a novel being written.
    past = target is not None and target["warning_level"] == "exceeded"
    return NumbersWords(
        total=total,
        by_status=by_status,
        scenes=len(leaves),
        written_scenes=len(written),
        mean_per_scene=round(sum(written) / len(written)) if written else 0,
        median_per_scene=round(median(written)) if written else 0,
        form=form,
        target=WordTarget(**target) if target else None,
        reads_as=form_for(total) if past else None,
    )


def _by_words(share: SpeakerShare) -> int:
    return share.word_count


def dialogue(view: StoryView, db: Session) -> NumbersDialogue:
    """Who speaks and how much, out loud: a thought is nobody's line. Lines nobody has been
    given to are counted, and left out of the shares, or "unknown" would be the loudest voice."""
    sync_story_dialogue(view.story.id, db)
    titles = {n.id: n.title or "" for n in view.leaves}
    blocks = (
        db.query(DialogueBlock)
        .filter(
            DialogueBlock.scene_id.in_(list(titles)),
            or_(DialogueBlock.dialogue_type.is_(None), DialogueBlock.dialogue_type != "thought"),
        )
        .all()
        if titles
        else []
    )
    spoken = [b for b in blocks if b.attribution_method != "unattributed" and b.speaker_name]

    # A character is one speaker however the line named them ("Calder", "The Visitor").
    names = {c.id: c.name for c in view.characters}
    shares: dict[str, SpeakerShare] = {}
    per_scene: dict[str, dict[str, int]] = {}
    for b in spoken:
        words = len(b.content.split())
        name = names.get(b.character_id or "", b.speaker_name)
        share = shares.setdefault(
            b.character_id or name,
            SpeakerShare(speaker_name=name, character_id=b.character_id, line_count=0, word_count=0),
        )
        share.line_count += 1
        share.word_count += words
        scene = per_scene.setdefault(b.scene_id, {})
        scene[name] = scene.get(name, 0) + words

    monologues: list[MonologueScene] = []
    for scene_id, speakers in per_scene.items():
        total = sum(speakers.values())
        if len(speakers) < 2 or not total:
            continue
        speaker, most = max(speakers.items(), key=lambda kv: kv[1])
        if most / total >= 0.8:
            monologues.append(
                MonologueScene(
                    scene_id=scene_id, scene_title=titles[scene_id], speaker=speaker, pct=round(most / total * 100)
                )
            )

    counts = [s.word_count for s in shares.values()]
    order = list(titles)
    speakers: list[SpeakerShare] = sorted(shares.values(), key=_by_words, reverse=True)
    monologues.sort(key=lambda m: order.index(m.scene_id))
    return NumbersDialogue(
        total_lines=len(blocks),
        unattributed=len(blocks) - len(spoken),
        balance=round((1 - gini(counts)) * 100) if len(counts) >= 2 else None,
        speakers=speakers,
        pairs=[
            SpeakerPair(
                a_id=p["character_a_id"],
                a_name=p["character_a_name"],
                b_id=p["character_b_id"],
                b_name=p["character_b_name"],
                scene_count=p["scene_count"],
            )
            for p in get_interaction_matrix(view.story.id, db)
        ],
        monologue_scenes=monologues,
    )


def prose(view: StoryView, db: Session) -> NumbersProse | None:
    """The latest local prose run, added up across the scenes it read."""
    log = latest_runs(view.story.id, db).get("prose-analysis")
    if log is None:
        return None
    scenes = [s for s in result_of(log).get("scenes", []) if s.get("scene_id") in view.by_id]
    sentences = passive = words_seen = adverbs = 0
    length_total = 0.0
    buckets: dict[str, int] = {}
    by_scene: list[ProseScene] = []
    for s in scenes:
        pv = s.get("passive_voice") or {}
        av = s.get("adverb_overuse") or {}
        sv = s.get("sentence_variety") or {}
        sentences += pv.get("sentence_count", 0)
        passive += pv.get("passive_count", 0)
        words_seen += av.get("word_count", 0)
        adverbs += av.get("adverb_count", 0)
        length_total += sv.get("mean_length", 0.0) * sv.get("sentence_count", 0)
        for b in sv.get("histogram", []):
            buckets[b["label"]] = buckets.get(b["label"], 0) + b["count"]
        by_scene.append(
            ProseScene(
                scene_id=s["scene_id"],
                passive_pct=round(pv.get("percentage", 0.0), 1),
                adverb_pct=round(av.get("percentage", 0.0), 1),
                mean_sentence=round(sv.get("mean_length", 0.0), 1),
            )
        )
    measured = sum(s.get("sentence_variety", {}).get("sentence_count", 0) for s in scenes if s.get("sentence_variety"))
    return NumbersProse(
        run_at=log.created_at,
        scenes=len(scenes),
        passive_pct=round(passive / sentences * 100, 1) if sentences else 0.0,
        adverb_pct=round(adverbs / words_seen * 100, 1) if words_seen else 0.0,
        mean_sentence=round(length_total / measured, 1) if measured else 0.0,
        sentence_lengths=[SentenceBucket(label=k, count=v) for k, v in buckets.items()],
        by_scene=by_scene,
    )


def summaries(view: StoryView) -> NumbersSummaries:
    written = view.written
    missing = sum(1 for n in written if not (n.content_summary or "").strip())
    stale = sum(1 for n in written if (n.content_summary or "").strip() and n.summary_stale)
    return NumbersSummaries(fresh=len(written) - missing - stale, stale=stale, missing=missing)


def numbers(story: Story, db: Session) -> NumbersOut:
    view = load_view(story, db)
    return NumbersOut(words=words(view), dialogue=dialogue(view, db), prose=prose(view, db), summaries=summaries(view))
