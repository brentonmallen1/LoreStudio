"""Data findings: absences, thread shape, empty chapters, the word target (doc 12 P3)."""

from app.models import PlotThread, PlotThreadAppearance
from app.services.findings.data import computed
from app.services.findings.view import load_view
from tests.fixtures.findings_story import build_findings_story


def _checks(story, db):
    return {f.check: f for f in computed(load_view(story, db))}


def test_a_significant_character_missing_from_the_last_scenes(db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    found = [f for f in computed(load_view(story, db_session)) if f.check == "absent_character"]
    assert len(found) == 1
    f = found[0]
    margaret = next(c for c in story.characters if c.name == "Margaret Holt")
    assert f.anchor.character_id == margaret.id
    assert f.evidence == "Last in Arrival" and f.action == "open_sheet" and f.kind == "cast"


def test_a_long_thread_with_no_try_fail_cycle(db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    thread = PlotThread(story_id=story.id, name="The light", status="open")
    db_session.add(thread)
    db_session.flush()
    for title in ("Arrival", "The Lamp", "Supper"):
        db_session.add(PlotThreadAppearance(thread_id=thread.id, node_id=nodes[title].id))
    db_session.commit()
    f = _checks(story, db_session)["thin_try_fail"]
    assert f.anchor.thread_id == thread.id and f.text == "The light runs through 3 scenes without a try/fail cycle"

    thread.try_fail_cycles = [{"try": "x", "fail": "y"}]
    db_session.commit()
    assert "thin_try_fail" not in _checks(story, db_session)


def test_empty_chapters_a_placeholder_at_the_end_and_a_hole_in_the_middle(db_session, test_user):
    story, nodes = build_findings_story(db_session, test_user)
    f = _checks(story, db_session)["empty_chapter"]
    assert f.text == "Chapter 3 has no words and no plan yet" and f.severity == "low" and f.action == "open_chapter"

    nodes["Chapter 3"].synopsis = "The keeper leaves."
    db_session.commit()
    assert "empty_chapter" not in _checks(story, db_session)  # planned and ahead: not news

    for title in ("Arrival", "The Lamp", "Supper"):
        nodes[title].word_count = 0
    db_session.commit()
    f = _checks(story, db_session)["empty_chapter"]
    assert f.text == "Chapter 1 is empty, but the chapters after it are written" and f.severity == "mid"


def test_no_chapter_checks_without_chapters(db_session, test_user):
    story, _ = build_findings_story(db_session, test_user, chapters=False)
    view = load_view(story, db_session)
    assert view.sizing.has_chapters is False
    assert "empty_chapter" not in {f.check for f in computed(view)}


def test_word_target_only_with_a_target(db_session, test_user):
    story, _ = build_findings_story(db_session, test_user)
    assert load_view(story, db_session).sizing.has_target is False
    assert "word_target" not in _checks(story, db_session)

    story.intended_length = "flash_fiction"
    db_session.commit()
    view = load_view(story, db_session)
    assert view.sizing.has_target is True
    assert "word_target" not in {f.check for f in computed(view)}  # 60 words is nowhere near

    for n in view.written:
        n.word_count = 400
    db_session.commit()
    f = _checks(story, db_session)["word_target"]
    assert f.text.startswith("2,400 words: past the") and f.severity == "mid" and f.anchor.node_id is None
