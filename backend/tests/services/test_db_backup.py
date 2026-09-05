from sqlalchemy import create_engine, text

from app.services.db_backup import backup_status, create_backup, list_backups


def test_backup_writes_file_and_prunes(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'live.db'}")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE t (x INTEGER)"))
        conn.execute(text("INSERT INTO t VALUES (1)"))
    out = tmp_path / "backups"
    paths = [create_backup(engine, out, keep=2) for _ in range(3)]
    assert all(p is not None for p in paths)
    remaining = list_backups(out)
    assert len(remaining) == 2
    status = backup_status(out)
    assert status["count"] == 2 and status["latest"]["filename"] == remaining[0]["filename"]
    copy = create_engine(f"sqlite:///{out / remaining[0]['filename']}")
    with copy.connect() as conn:
        assert conn.execute(text("SELECT x FROM t")).scalar() == 1


def test_backup_skips_in_memory():
    assert create_backup(create_engine("sqlite:///:memory:")) is None
