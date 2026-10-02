"""Snapshots must cover every story-owned table, and restore must round-trip (B8, B9)."""

from sqlalchemy import text

from app.database import Base
from app.services import snapshot_service as svc
from tests.fixtures.story_factory import build_full_story, story_owned_tables


def test_every_story_owned_table_is_snapshotted():
    tables = story_owned_tables(Base.metadata)
    missing = [t for t in tables if t not in svc.SNAPSHOT_KEYS_BY_TABLE]
    assert missing == [], f"tables with story_id not covered by snapshots: {missing}"
    # every table referenced by a FK to a story-owned table is either covered or listed
    covered = set(svc.SNAPSHOT_KEYS_BY_TABLE) | set(svc.SNAPSHOT_INDIRECT_TABLES) | svc.SNAPSHOT_EXCLUDED_TABLES
    story_tables = set(tables)
    dependants = set()
    for t in Base.metadata.sorted_tables:
        for fk in t.foreign_keys:
            if fk.column.table.name in story_tables and t.name not in (
                "users",
                "beat_sheets",
                "story_structure_templates",
            ):
                dependants.add(t.name)
    uncovered = sorted(d for d in dependants if d not in covered and "story_id" not in Base.metadata.tables[d].c)
    assert uncovered == [], f"child tables not covered by snapshots: {uncovered}"


def test_serialize_includes_every_declared_key(db_session, test_user):
    story = build_full_story(db_session, test_user)
    data = svc.serialize_story(story.id, db_session)
    for key in set(svc.SNAPSHOT_KEYS_BY_TABLE.values()) | set(svc.SNAPSHOT_INDIRECT_TABLES.values()):
        assert key in data, f"serialize_story omits {key}"
        assert data[key], f"serialize_story produced empty {key} for a fully populated story"


def _row_counts(db, sid: str) -> dict[str, int]:
    counts = {}
    for t in story_owned_tables(Base.metadata):
        counts[t] = db.execute(text(f"SELECT count(*) FROM {t} WHERE story_id = :sid"), {"sid": sid}).scalar()
    for t in svc.SNAPSHOT_INDIRECT_TABLES:
        counts[t] = db.execute(text(f"SELECT count(*) FROM {t}")).scalar()
    return counts


def test_snapshot_restore_roundtrip(db_session, test_user):
    story = build_full_story(db_session, test_user)
    sid = story.id
    before = _row_counts(db_session, sid)
    snap = svc.create_snapshot(sid, db_session, trigger="manual", name="s1", force=True)
    db_session.commit()

    # mutate: rename the story, drop a scene's notes, add a character
    story.title = "Changed"
    scene = next(n for n in story.structure_nodes if n.title == "Lamp")
    scene.purpose = "changed"
    from app.models import Note

    db_session.query(Note).filter(Note.node_id == scene.id).delete()
    from app.models import Character

    db_session.add(Character(story_id=sid, name="Extra"))
    db_session.commit()

    restored = svc.restore_snapshot(snap, db_session, create_safety_backup=False)
    db_session.commit()
    db_session.expire_all()

    assert restored.title == "Factory Story"
    after = _row_counts(db_session, sid)
    assert after == before, {k: (before[k], after[k]) for k in before if before[k] != after[k]}
    scene = next(n for n in restored.structure_nodes if n.title == "Lamp")
    note = db_session.get(Note, "n1")
    assert (note.node_id, note.content, note.anchor) == (scene.id, "keep", "We should go")
    assert scene.purpose == "setup"
    assert restored.pov_character_id is not None


def test_restore_via_api(client, db_session, test_user):
    story = build_full_story(db_session, test_user)
    sid = story.id
    snap = client.post(f"/api/stories/{sid}/snapshots", json={"name": "s1"})
    assert snap.status_code == 200, snap.text
    r = client.post(f"/api/stories/{sid}/snapshots/{snap.json()['id']}/restore", json={"create_safety_backup": True})
    assert r.status_code == 200, r.text


def test_backup_settings_survive_two_first_requests(db_session, test_user):
    """
    Opening a story sent two requests that both created its backup settings; the second
    hit the UNIQUE constraint and returned a 500. Losing the race now reads the winner's row.
    """
    from unittest.mock import patch

    from sqlalchemy.orm import Query

    from app.models.snapshot import StoryBackupSettings
    from app.models.story import Story
    from app.services.snapshot_service import _get_or_create_settings

    story = Story(title="Race", user_id=test_user.id)
    db_session.add(story)
    db_session.flush()
    winner = StoryBackupSettings(story_id=story.id)
    db_session.add(winner)
    db_session.commit()

    # This request looked before the other one's row existed.
    with patch.object(Query, "first", return_value=None):
        got = _get_or_create_settings(story.id, db_session)
    assert got.id == winner.id
    assert db_session.query(StoryBackupSettings).filter_by(story_id=story.id).count() == 1
