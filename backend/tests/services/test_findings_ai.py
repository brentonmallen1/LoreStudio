"""Assistant runs read as findings (doc 12 P3): one adapter per check, latest run only."""

from datetime import UTC, datetime, timedelta

from app.models.activity_log import ActivityLog
from app.services.findings import collect
from app.services.findings.ai import to_findings
from app.services.findings.view import load_view
from tests.fixtures.findings_story import build_findings_story

NOW = datetime(2026, 9, 30, 12, tzinfo=UTC)


def _log(story, user, feature, data, *, success=True, at=NOW, event="analysis_run", description=None):
    if event == "editorial_pass":
        meta = {"feature": feature, **data}
    else:
        meta = {"feature": feature, "result": {"success": success, "data": data}}
    return ActivityLog(
        user_id=user.id,
        story_id=story.id,
        event_type=event,
        category="health",
        description=description or f"{feature} ran",
        metadata_=meta,
        created_at=at,
    )


def _run(db, story, user, feature, data, **kw):
    return to_findings(load_view(story, db), feature, _log(story, user, feature, data, **kw))


def test_pacing_slow_spots_anchor_to_the_scene_they_name(db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    [f] = _run(db_session, story, test_user, "pacing-analysis", {"slow_spots": ['"The Storm" drags in the middle']})
    assert f.anchor.node_id == nodes["The Storm"].id and f.where == "The Storm"
    assert f.passages == []  # an explanation, not a quote
    assert (f.kind, f.source, f.action, f.feature) == ("structure", "ai", "open_scene", "pacing-analysis")


def test_continuity_and_plot_holes_map_severity(db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    issue = {"description": "The lamp is lit twice", "severity": "critical", "scene_references": ["Supper"]}
    [f] = _run(db_session, story, test_user, "continuity-check", {"issues": [issue]})
    assert (f.severity, f.kind, f.anchor.node_id) == ("high", "continuity", nodes["Supper"].id)

    holes = {"holes": [{"description": "Who sent the letter?", "severity": "minor"}], "logic_gaps": ["A small gap"]}
    found = _run(db_session, story, test_user, "plot-holes", holes)
    assert [(f.text, f.severity, f.action) for f in found] == [
        ("Who sent the letter?", "low", "ask"),
        ("A small gap", "low", "ask"),
    ]


def test_flat_characters_point_at_their_sheet(db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    margaret = next(c for c in story.characters if c.name == "Margaret Holt")
    data = {
        "characters": [
            {"character_name": "Margaret Holt", "dimension_score": "flat", "gaps": ["no want of her own"]},
            {"character_name": "Eleanor Vance", "dimension_score": "dimensional"},
        ]
    }
    [f] = _run(db_session, story, test_user, "character-dimensionality", data)
    assert f.text == "Margaret Holt reads flat: no want of her own"
    assert (f.anchor.character_id, f.action, f.kind) == (margaret.id, "open_sheet", "cast")


def test_cliches_keep_only_passages_still_in_the_prose(db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    lamp = nodes["The Lamp"].id
    data = {
        "categories": [
            {
                "name": "phrase",
                "instances": [
                    {"passage": "listened to the sea", "scene_id": lamp, "severity": "subtle", "explanation": "worn"},
                    {"passage": "dark and stormy night", "scene_id": lamp, "severity": "strong"},
                ],
            }
        ]
    }
    [f] = _run(db_session, story, test_user, "cliche-analysis", data)
    assert f.evidence == "listened to the sea" and f.severity == "low" and f.anchor.node_id == lamp
    assert f.passages == ["listened to the sea"]


def test_meaning_checks(db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    [theme] = _run(db_session, story, test_user, "theme-tracker", {"gaps": ["Isolation is set up and dropped"]})
    assert (theme.kind, theme.action) == ("meaning", "ask")

    first = {"gaps": [{"finding": "The goal is unstated", "severity": "moderate", "scene_references": ["Arrival"]}]}
    [gap] = _run(db_session, story, test_user, "first-pass", first)
    assert gap.anchor.node_id == nodes["Arrival"].id

    questions = {"want": {"status": "unclear", "question": "What does she want?"}, "why": {"status": "clear"}}
    [q] = _run(db_session, story, test_user, "essential-questions", questions)
    assert (q.text, q.severity, q.where) == ("What does she want?", "mid", "Story identity")


def test_the_editorial_pass(db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    report = {
        "priorities": {
            "priorities": [
                {
                    "rank": 1,
                    "section_title": "Supper",
                    "issue": "Nothing happens",
                    "impact": "high",
                    "suggestion": "?",
                    "anchor": "counted the ships",
                }
            ]
        },
        "intent_gaps": {
            "gaps": [{"section_title": "Morning", "gap": "Meant to be tense", "execution": "calm", "suggestion": ""}]
        },
        "fresh_eyes": {"questions": [{"section_title": "The Letter", "question": "Whose letter?"}]},
    }
    found = to_findings(
        load_view(story, db_session),
        "editorial-pass",
        _log(story, test_user, "editorial-pass", report, event="editorial_pass"),
    )
    assert [(f.kind, f.severity, f.anchor.node_id) for f in found] == [
        ("prose", "high", nodes["Supper"].id),
        ("meaning", "mid", nodes["Morning"].id),
        ("continuity", "low", nodes["The Letter"].id),
    ]
    assert [f.passages for f in found] == [["counted the ships"], [], []]


def test_a_check_with_no_adapter_still_shows_once(db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    [f] = _run(db_session, story, test_user, "economy-analysis", {"recommendations": ["x"]}, description="Economy ran")
    assert (f.text, f.action, f.source) == ("Economy ran", "ask", "ai")


def test_not_findings_and_failed_runs_give_nothing(db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    assert _run(db_session, story, test_user, "entity-suggestions", {"character_suggestions": []}) == []
    assert _run(db_session, story, test_user, "pacing-analysis", {"slow_spots": ["Supper"]}, success=False) == []


def test_only_the_latest_run_of_a_check_counts(db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    db_session.add_all(
        [
            _log(
                story, test_user, "pacing-analysis", {"slow_spots": ["Old: Supper drags"]}, at=NOW - timedelta(days=1)
            ),
            _log(story, test_user, "pacing-analysis", {"slow_spots": ["New: Morning drags"]}, at=NOW),
            _log(story, test_user, "prose-analysis", {"scenes": []}, at=NOW),
        ]
    )
    db_session.commit()
    out = collect(story, db_session)
    pacing = [f.text for f in out.findings if f.check == "pacing-analysis"]
    assert pacing == ["Drags: New: Morning drags"]
    assert set(out.last_ai_run_by_feature) == {"pacing-analysis"}
    assert out.last_local_run is not None


def test_a_job_that_logs_a_run_is_not_a_check(db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    assert _run(db_session, story, test_user, "scene-summary-batch", {"summarized": 3}) == []
