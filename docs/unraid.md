# LoreStudio on Unraid

The all-in-one container is the simple way: one container, one port, one appdata folder.

## Install

1. **Add the template.** *Docker → Template Repositories* (bottom of the page), add
   `https://github.com/brentonmallen1/LoreStudio`, Save. (Or copy `unraid/lorestudio.xml` to
   `/boot/config/plugins/dockerMan/templates-user/`.)
2. **Add the container.** *Docker → Add Container → Template*, pick **lorestudio**.
3. **Fill in:**
   - **Admin Password** (required): the password for the `admin` account.
   - **Data**: `/mnt/user/appdata/lorestudio` unless you keep appdata elsewhere.
   - **Ollama URL** and **Ollama Model** if you want the AI features (see below).
4. **Apply**, wait for the container to show *healthy* (the first start migrates and seeds the
   demo story, about a minute), then open the WebUI and sign in as `admin`.

Left empty, **Secret Key** is made on first start and kept in the data folder
(`.secret_key`), so sign-ins survive restarts and updates. **PUID/PGID** default to Unraid's
`nobody:users` (99:100), who will own the data folder.

## AI with Ollama on the same server

LoreStudio's AI features call an Ollama server; everything else works without one.

1. Install Ollama from Community Applications (the official `ollama/ollama` image), with a GPU
   if you have one.
2. In its console, pull the model: `ollama pull gemma4`.
3. In LoreStudio's template, set **Ollama URL** to `http://<your server's IP>:11434`.
   (`localhost` inside the container is the container, not the server.)
4. In the app, *Settings › AI* shows whether the model answers.

Writer mode (*Settings*) hides every AI feature if you would rather not see them.

## What is in the data folder

| Path | What |
|---|---|
| `lorestudio.db` (+ `-wal`, `-shm`) | The database: every story, character, scene and setting |
| `uploads/` | Images and files you added |
| `snapshots/` | Story versions you saved |
| `backups/` | Automatic copies of the database (*Settings › Automatic work*) |
| `.secret_key` | Made on first start when no Secret Key is set |

Back up the whole folder (the *Appdata Backup* plugin does). The automatic database backups
inside it are not a backup of the server.

## Updating

*Docker → Check for Updates*, then *Update*. The new version migrates the database on start;
the first start after an update can take a little longer. Read the release notes on GitHub
first for anything marked as needing a step. To go back, see [upgrading.md](upgrading.md).

## Two containers instead

`unraid/lorestudio-backend.xml` and `unraid/lorestudio-frontend.xml` run the API and the web
interface separately on a custom network:

1. In a terminal, once: `docker network create lorestudio`.
2. Install **lorestudio-backend** (set Admin Password and Secret Key; its data folder must be
   writable by uid 1000).
3. Install **lorestudio-frontend** (WebUI on 8480). Its **API** setting is the backend's name on
   the network and port: `lorestudio-backend:8000`.

## Troubleshooting

- **The container stops right after starting**: the log says why. Most often the Admin Password
  is empty or a default.
- **AI features say the model is not answering**: open the Ollama URL from another machine
  (`http://<ip>:11434` answers "Ollama is running"), and check the model name matches
  `ollama list`.
- **Permission errors on the data folder**: PUID/PGID should own it; the container takes it
  over on start if it does not.
