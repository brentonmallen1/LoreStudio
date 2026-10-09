# Deploying LoreStudio

LoreStudio is one person's (or a household's) writing room on their own hardware: a web app, a
SQLite database and, for the AI features, an [Ollama](https://ollama.com) server you run. There
are two ways to deploy it with Docker. On Unraid, see [unraid.md](unraid.md).

## The all-in-one (recommended)

One container serves the app and its API on one port, with everything it keeps in one folder.

```bash
docker run -d --name lorestudio \
  -p 8080:8080 \
  -e ADMIN_PASSWORD='a strong password' \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  --add-host host.docker.internal:host-gateway \
  -v ./data:/data \
  --restart unless-stopped \
  ghcr.io/brentonmallen1/lorestudio:latest
```

Or with compose. All it needs is the compose file and a `.env` beside it, without a checkout:

```bash
mkdir lorestudio && cd lorestudio
curl -fsSL -o compose.yaml \
  https://raw.githubusercontent.com/brentonmallen1/LoreStudio/main/docker-compose.aio.yml
echo "ADMIN_PASSWORD=a-strong-password" > .env
docker compose up -d
```

Your stories are kept in `./data` beside it. From a checkout, `cp .env.example .env` and
`docker compose -f docker-compose.aio.yml up -d` do the same.

Open `http://<host>:8080` and sign in as `admin`. The first start migrates the database and adds
the demo story; give it a minute.

- **`SECRET_KEY`**: leave it unset and one is made on first start and kept in
  `/data/.secret_key`, so sign-ins survive restarts and updates. Set your own to manage it
  yourself.
- **`PUID` / `PGID`**: who owns `/data` (default 1000:1000). The container takes the folder
  over on start if it belongs to someone else.
- **`TZ`**: the timezone for dates and the schedule of automatic work.

## Two containers

[`docker-compose.yml`](../docker-compose.yml) runs the API (`lorestudio-backend`) and the web
front (`lorestudio-frontend`, nginx serving the app and proxying `/api`) separately:

```bash
cp .env.example .env     # set SECRET_KEY and ADMIN_PASSWORD (both required here)
docker compose up -d
```

The API's port is not published; everything goes through the web front on `WEB_PORT` (8080).
The web front finds the API at `API_UPSTREAM` (`backend:8000`, the compose service).

## Images and versions

| Image | What |
|---|---|
| `ghcr.io/brentonmallen1/lorestudio` | The all-in-one |
| `ghcr.io/brentonmallen1/lorestudio-backend` | The API |
| `ghcr.io/brentonmallen1/lorestudio-frontend` | The web front |

Each release is tagged by date, `2026.10.1` (year, month, the release in that month), and also
`2026.10` and `latest`. Pin a full version to update only when you choose (`LORESTUDIO_TAG` in
the compose files). Images are built for amd64 and arm64.

To build them yourself: `just aio-build` (the all-in-one) or `docker compose build`.

## Configuration

Every variable is in [CONFIGURATION.md](CONFIGURATION.md). With the images:

- `ENV` is `prod`: the app refuses to start with a default `ADMIN_PASSWORD` or `SECRET_KEY`.
- The data paths are set by the image (`/data` in the all-in-one, `/app/data` in the API image);
  `.env` values for them are for running from source and are overridden.
- Every other variable in `.env` reaches the app (the compose files pass the whole file).

## AI

The AI features call `OLLAMA_BASE_URL`. Inside a container, `localhost` is the container itself:
use `host.docker.internal` (mapped by the compose files and the `docker run` above) for Ollama on
the same machine, or the machine's address. Pull the model first (`ollama pull gemma4`).
Everything except the AI features works without Ollama, and Writer mode hides them entirely.

## Behind a reverse proxy

Point the proxy at the app's port (8080). Two things matter:

- **Streaming.** Assistant replies and job progress stream over long-lived responses. Turn off
  response buffering for `/api/` and allow long reads (the images' nginx uses 15 minutes; a slow
  local model can take minutes to answer).
- **Uploads** can be large (images, imported manuscripts): allow at least 100 MB bodies.

For nginx in front:

```nginx
location / {
    proxy_pass http://lorestudio:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_read_timeout 900s;
    client_max_body_size 100m;
}
```

## Data and backups

Everything LoreStudio keeps is in the data folder: the database (`lorestudio.db` with its `-wal`
and `-shm`), `uploads/`, `snapshots/` (story versions) and `backups/`.

- *Settings › Automatic work* copies the database into `backups/` on a schedule (daily, 14 kept,
  by default); *Settings › System* can make one now.
- Each story's *Versions* page saves and exports versions you can import elsewhere.
- Neither is a backup of the server: back up the whole data folder with your usual tool. With the
  app running, copy a backup from `backups/` rather than the live `lorestudio.db`.

## Updating

Pull the new image and recreate the container (`docker compose pull && docker compose up -d`).
The database migrates on start. Read the release notes first; [upgrading.md](upgrading.md) has
what to check and how to go back.

## Starting over

Stop the container and empty the data folder (keep a copy). The next start makes a fresh
database, the admin account and the demo story.
