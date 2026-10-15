"""Opening a story fires its auto-backup check twice at once (two tabs, or React running the
effect twice): only one of them may back up. Two sessions on one file are the two requests."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.models  # noqa: F401 — registers every table
from app.database import Base
from app.models import Story, StoryBackupSettings, StorySnapshot, User
from app.services.dialogue_service import sync_story_dialogue
from app.services.snapshot_service import claim_auto_backup, create_snapshot, release_auto_backup


def _two_requests(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'race.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with Session(engine) as setup:
        setup.add(User(id="u", username="u", password_hash="x", display_name="U"))
        setup.add(Story(id="s", user_id="u", title="Salt"))
        setup.add(StoryBackupSettings(story_id="s", auto_enabled=True, interval_minutes=30))
        setup.commit()
    a, b = Session(engine), Session(engine)
    # Both read the settings before either writes: neither has backed up yet.
    return a, b, a.query(StoryBackupSettings).one(), b.query(StoryBackupSettings).one()


def test_only_one_of_two_checks_at_once_backs_up(tmp_path):
    a, b, seen_a, seen_b = _two_requests(tmp_path)
    now = datetime.now(UTC)
    assert seen_a.last_auto_backup_at is None and seen_b.last_auto_backup_at is None
    assert claim_auto_backup(a, seen_a, now) is True
    assert claim_auto_backup(b, seen_b, now) is False


def test_the_slot_opens_again_after_the_interval(tmp_path):
    a, b, seen_a, seen_b = _two_requests(tmp_path)
    now = datetime.now(UTC)
    assert claim_auto_backup(a, seen_a, now)
    assert not claim_auto_backup(b, b.query(StoryBackupSettings).one(), now + timedelta(minutes=10))
    assert claim_auto_backup(b, b.query(StoryBackupSettings).one(), now + timedelta(minutes=31))


def test_a_check_with_nothing_to_back_up_gives_the_slot_back(tmp_path):
    """Nothing changed: the next check may back up as soon as something does, as before."""
    a, b, seen_a, _ = _two_requests(tmp_path)
    now = datetime.now(UTC)
    assert claim_auto_backup(a, seen_a, now)
    release_auto_backup(a, seen_a, now, previous=None)
    assert claim_auto_backup(b, b.query(StoryBackupSettings).one(), now + timedelta(minutes=1))


def test_the_import_version_holds_the_dialogue_so_the_first_backup_finds_nothing_new(client, db_session):
    """ "As imported" read the story's dialogue first; the first auto-backup then had only
    those rows to save, a snapshot with nothing in it the author made."""
    from app.models import StoryStructureTemplate
    from app.services.seed import STRUCTURE_TEMPLATES

    db_session.add(
        StoryStructureTemplate(**next(t for t in STRUCTURE_TEMPLATES if t["id"] == "freeform"), is_system=True)
    )
    db_session.commit()
    up = client.post(
        "/api/import/upload",
        files={"file": ("draft.md", b'# One\n\n"Wait," she said.\n\n# Two\n\nMore.', "text/markdown")},
    ).json()
    done = client.post(f"/api/import/{up['session_id']}/finalize", json={"title": "Draft", "template_id": "freeform"})
    story_id = done.json()["id"]
    sync_story_dialogue(story_id, db_session)  # what opening the story does (the findings count)
    db_session.commit()
    assert create_snapshot(story_id, db_session, trigger="auto") is None
    assert [s.name for s in db_session.query(StorySnapshot).filter_by(story_id=story_id)] == ["As imported"]
