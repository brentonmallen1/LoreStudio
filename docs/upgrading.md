# Upgrading LoreStudio

## Versioning

Releases are tagged `vYYYY.MM.N` (calendar version, N counts releases within the
month). Container images carry the version without the `v` (`2026.10.1`), the month
(`2026.10`) and `latest`. *Settings › System* shows the version running. Breaking
changes are listed at the bottom of this page under the release that introduced them.
The sign-in page shows the version too, at its foot.

## Knowing a new version is out

*Settings › About and updates* shows the version running and, after a check, the latest
release with its notes and how to update this install. **Check now** asks GitHub once.
A daily check can be switched on under *Settings › Automatic work*; it is off by default.
When a newer version is out, the logo menu says so. Nothing about you or your stories is sent.

## What happens on start

Every backend start runs the database migrations before serving requests:

1. **Fresh database** (no tables): the full schema is created from the Alembic
   migration chain and stamped at head.
2. **Database created by an older LoreStudio** (tables exist but no Alembic
   version, or a version from the pre-2026.09 migration chain): missing tables
   are created, the schema is stamped at the new baseline, and later migrations
   apply on top. Nothing is dropped.
3. **Database already on the new chain**: `alembic upgrade head`. Before the first
   migration runs, the database is copied whole to
   `backups/before-upgrade-<date>-<revision>.db`. The three newest copies are kept, apart
   from the rotating backups, which never prune them.
4. **Database saved by a newer LoreStudio** (a migration this version doesn't know):
   the backend refuses to start and logs which version the data needs. Nothing is
   changed. Install that version or a newer one.

The result is logged as a System entry in Chronicle and in the backend log
(`migrations: fresh|adopted|upgraded|current`). Set `AUTO_MIGRATE=false` to skip
this and run `just db-migrate` yourself.

## Before upgrading

- Copy the whole data folder, or at least make a database backup (*Settings ›
  System*): the copies in `backups/` are plain SQLite files. A version of each
  story you care about (its Versions page) is a second, per-story safety net.
- Read the breaking changes below for the versions you are skipping.

## Upgrading with Docker Compose

```bash
docker compose pull      # or, from a checkout: git pull && docker compose build
docker compose up -d
docker compose logs -f backend   # watch for "migrations:" and "startup complete"
```

For the all-in-one, add `-f docker-compose.aio.yml` and read the `lorestudio` service's log.

## Upgrading on Unraid

*Docker → Check for Updates* shows an update when a new image is published.
Click **Update**, wait for the container to restart, and check its log for the
`migrations:` line. The data folder is untouched by the update. See
[unraid.md](unraid.md).

## Upgrading the desktop app

*Settings › About and updates* › **Install and restart** downloads the new version, checks
its signature, replaces the app and opens it again. The data folder is untouched, and the
database is copied to `backups/` before it is upgraded, as above. Downloading the new `.dmg`
and dragging it over the old app does the same. See [desktop/README.md](../desktop/README.md).

## Rolling back

1. Stop the container.
2. Restore `lorestudio.db` from `backups/`: the `before-upgrade-…` copy is the database
   exactly as the previous version left it. Delete `lorestudio.db-wal` and `-shm` beside
   it. Or restore the whole data folder from your copy.
3. Pin the previous image (`ghcr.io/brentonmallen1/lorestudio:2026.09.1`, or
   `LORESTUDIO_TAG=2026.09.1` with the compose files) and start again.
   Migrations never downgrade. An older version refuses a database a newer one has
   upgraded, which is why step 2 comes first.

## Breaking changes

### 2026.10 (doc 23)

- **The images build from the repository root** and the web front listens on
  **8080** (it was 80, published as 5173). `docker-compose.yml` serves on
  `WEB_PORT` (8080) and no longer publishes the API's port.
- **`CONFIG_PATH` is gone**: nothing read it. Everything is in the data folder.

### 2026.09 (refactor Stage 0)

- **Default secrets are refused outside development.** With `ENV=prod` (the
  default in the Docker images and compose file) the backend exits at start if
  `SECRET_KEY` or `ADMIN_PASSWORD` is still a default value. Set both.
- **Only one demo story is seeded** ("The Last Lighthouse"), and only into an
  empty database. Set `SEED_DEMO=false` to seed none, `SEED_EXTRA_DEMOS=true`
  for the other four.
- **SQLite foreign keys are enforced.** Deleting a story now removes all of
  its rows. Orphan rows left by earlier versions are harmless and are ignored.
- **Alembic chain replaced.** The old revisions never created tables from empty
  and are gone; existing databases are adopted automatically (case 2 above).
- `OLLAMA_MODEL` default in `docker-compose.yml` is now `gemma4` (was
  `llama3.2`) to match the application default.
