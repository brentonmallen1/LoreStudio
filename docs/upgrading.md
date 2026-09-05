# Upgrading LoreStudio

## Versioning

Releases are tagged `vYYYY.MM.N` (calendar version, N counts releases within the
month). Container images carry the same tag plus `latest`. Breaking changes are
listed at the bottom of this page under the release that introduced them.

## What happens on start

Every backend start runs the database migrations before serving requests:

1. **Fresh database** (no tables): the full schema is created from the Alembic
   migration chain and stamped at head.
2. **Database created by an older LoreStudio** (tables exist but no Alembic
   version, or a version from the pre-2026.09 migration chain): missing tables
   are created, the schema is stamped at the new baseline, and later migrations
   apply on top. Nothing is dropped.
3. **Database already on the new chain**: `alembic upgrade head`.

The result is logged as a System entry in Chronicle and in the backend log
(`migrations: fresh|adopted|upgraded|current`). Set `AUTO_MIGRATE=false` to skip
this and run `just db-migrate` yourself.

## Before upgrading

- Take a snapshot of each story you care about (Versions page), or copy the
  whole `data/` directory. The nightly database backup in `data/backups/` is
  also usable: it is a plain SQLite file.
- Read the breaking changes below for the versions you are skipping.

## Upgrading with Docker Compose

```bash
git pull
docker compose pull      # or: docker compose build
docker compose up -d
docker compose logs -f backend   # watch for "migrations:" and "startup complete"
```

## Upgrading on unraid

Community Applications shows an update when a new image tag is published.
Click **Update**, wait for the container to restart, and check the log for the
`migrations:` line. The `/data` volume is untouched by the update.

## Rolling back

1. Stop the container.
2. Restore `data/lorestudio.db` from `data/backups/` (or the whole `data/`
   directory from your copy).
3. Pin the previous image tag (`ghcr.io/brentonmallen1/lorestudio:v2026.09.1`)
   and start again. Migrations never downgrade automatically.

## Breaking changes

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
