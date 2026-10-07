"""Local findings: name drift and unknown speakers on every read, spaCy runs from the log."""

from app.models.activity_log import ActivityLog
from app.models.dialogue import DialogueBlock
from app.services.findings import collect
from app.services.findings.local import computed, from_editorial_run, from_prose_run
from app.services.findings.view import load_view
from tests.fixtures.findings_story import build_findings_story


def _log(story, user, feature: str, result: dict) -> ActivityLog:
    return ActivityLog(
        id=f"log-{feature}",
        user_id=user.id,
        story_id=story.id,
        event_type="analysis_run",
        category="health",
        description=f"{feature} ran",
        metadata_={"feature": feature, "result": result},
    )


def test_name_drift_is_found_with_its_fix(db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    found = computed(load_view(story, db_session), db_session)
    drift = [f for f in found if f.check == "name_drift"]
    assert len(drift) == 1
    f = drift[0]
    assert f.anchor.node_id == nodes["The Lamp"].id
    assert f.where == "The Lamp"
    assert f.action == "fix" and f.fix is not None
    assert (f.fix.old, f.fix.new) == ("Elenor", "Eleanor")
    assert "Elenor lit the lamp" in f.evidence
    assert f.passages == ["Elenor"]  # the slip itself, for the editor to light up


def test_reading_the_feed_writes_nothing(db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    collect(story, db_session)
    assert not db_session.new and not db_session.dirty
    # The consistency check used to sync dialogue rows first; the feed must not.
    assert db_session.query(DialogueBlock).count() == 0


def test_prose_run_findings_drop_passages_the_author_rewrote(db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    lamp, supper = nodes["The Lamp"], nodes["Supper"]
    passage = {"passage": "listened to the sea below the rocks", "severity": "warning", "suggestion": "Cut it?"}
    gone = {"passage": "a sentence no longer in the scene", "severity": "warning"}
    result = {
        "scenes": [
            {"scene_id": lamp.id, "scene_title": "The Lamp", "adverb_overuse": {"findings": [passage, gone]}},
            {"scene_id": supper.id, "scene_title": "Supper", "passive_voice": {"findings": [gone]}},
            {"scene_id": "deleted-scene", "scene_title": "Gone", "passive_voice": {"findings": [passage]}},
            {"scene_id": supper.id, "scene_title": "Supper", "sentence_variety": {"assessment": "monotonous"}},
        ]
    }
    found = from_prose_run(load_view(story, db_session), _log(story, test_user, "prose-analysis", result))
    by_check = {(f.check, f.anchor.node_id): f for f in found}
    adverbs = by_check[("adverb_overuse", lamp.id)]
    assert adverbs.text == "Leans on an adverb"  # the rewritten one no longer counts
    assert adverbs.suggestion == "Cut it?" and adverbs.source == "local" and adverbs.run_id == "log-prose-analysis"
    assert adverbs.passages == ["listened to the sea below the rocks"]
    assert ("passive_voice", supper.id) not in by_check  # every passage gone: answered
    assert by_check[("sentence_variety", supper.id)].passages == []  # a statistic, not a quote
    assert all(f.anchor.node_id != "deleted-scene" for f in found)


def test_a_count_change_keeps_the_same_id(db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    lamp = nodes["The Lamp"]
    one = {"passage": "lit the lamp", "severity": "warning"}
    two = {"passage": "listened to the sea", "severity": "warning"}

    def run(findings):
        result = {"scenes": [{"scene_id": lamp.id, "passive_voice": {"findings": findings}}]}
        return from_prose_run(load_view(story, db_session), _log(story, test_user, "prose-analysis", result))[0]

    assert run([one]).id == run([one, two]).id
    assert run([one, two, one]).passages == ["lit the lamp", "listened to the sea"]  # every one, once


def test_editorial_run_gives_tense_and_pov_findings(db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    lamp = nodes["The Lamp"]
    result = {
        "scenes": [
            {
                "scene_id": lamp.id,
                "tense_consistency": {"dominant_tense": "past", "findings": [{"sentence": "Elenor lit the lamp"}]},
                "pov_drift": {
                    "dominant_subject": "Eleanor",
                    "findings": [{"sentence": "listened to the sea", "subjects": ["Margaret", "people", "Eleanor"]}],
                },
            }
        ]
    }
    found = from_editorial_run(load_view(story, db_session), _log(story, test_user, "editorial-consistency", result))
    texts = {f.check: f.text for f in found}
    assert texts == {
        "tense_shift": "Slips out of past tense once",
        "pov_drift": "Point of view slips into Margaret's head",
    }
    passages = {f.check: f.passages for f in found}
    assert passages == {"tense_shift": ["Elenor lit the lamp"], "pov_drift": ["listened to the sea"]}


def test_pov_drift_needs_another_character(db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    lamp = nodes["The Lamp"]

    def run(subjects):
        scene = {
            "scene_id": lamp.id,
            "pov_drift": {
                "dominant_subject": "Eleanor",
                "findings": [{"sentence": "lit the lamp", "subjects": subjects}],
            },
        }
        log = _log(story, test_user, "editorial-consistency", {"scenes": [scene]})
        return [f.text for f in from_editorial_run(load_view(story, db_session), log)]

    # "people" and the scene's own point of view are not a slip.
    assert run(["people", "Eleanor"]) == []
    assert run(["Margaret"]) == ["Point of view slips into Margaret's head"]


def test_scene_titles_resolve_exactly_or_when_quoted(db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    view = load_view(story, db_session)
    assert view.scene_named("the storm") is nodes["The Storm"]
    assert view.scene_named('"The Storm" drags in its middle') is nodes["The Storm"]
    assert view.scene_named("Nowhere at all") is None
    # Reading order through the tree; an empty chapter is a leaf, as on the strip.
    assert [n.title for n in view.leaves] == [*list(nodes)[1:4], *list(nodes)[5:8], "Chapter 3"]
