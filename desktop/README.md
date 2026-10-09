# LoreStudio for the desktop (macOS proof of concept)

LoreStudio as a Mac app. It's the same web app the Docker image serves, in its own window, over
its own copy of the backend. Python, WeasyPrint's libraries, spaCy and its English model, and
pandoc are all inside the app. Only Ollama, for the AI features, is installed separately.

## Build it

On an Apple silicon Mac with Rust (`rustup`), Node, uv and `brew install pango`:

```bash
just desktop
open desktop/src-tauri/target/release/bundle/macos/LoreStudio.app
```

That builds `LoreStudio.app` (about 340 MB) and `LoreStudio.dmg` (about 135 MB) beside it.
`just desktop-backend` rebuilds only the frozen backend.

## Installing a downloaded build

1. Open `LoreStudio.dmg` and drag **LoreStudio** onto **Applications**.
2. Open LoreStudio. macOS says it can't verify the app, because LoreStudio isn't signed
   with an Apple Developer ID. Click **Done**.
3. Open **System Settings → Privacy & Security**. Scroll down to the Security section, where
   it says "LoreStudio" was blocked, then click **Open Anyway** and confirm with your password
   or Touch ID.
4. LoreStudio opens, and from then on it opens like any other app. A new version downloaded
   later asks once again.

If you're comfortable in Terminal, `xattr -dr com.apple.quarantine /Applications/LoreStudio.app`
does the same as step 3.

## How it fits together

| Piece | Where | What it does |
|---|---|---|
| The shell | `src-tauri/src/main.rs` | Tauri 2. Starts the backend, shows `splash/` until it answers, signs the window in, routes downloads and new windows |
| The backend's entry | `backend/lorestudio_desktop.py` | Sets up the data folder, secrets, fonts and bundled libraries, then serves the API and the web app on `127.0.0.1` |
| The freeze | `backend/lorestudio-backend.spec` | PyInstaller, as a folder (one file would unpack itself on every launch) |
| The build | `just desktop` (Justfile) | Web app, pandoc download, freeze, Tauri, then the backend copied in with `ditto` |

### The shell and the backend

- **Data:** the database, uploads and backups live in `~/Library/Application Support/app.lorestudio.desktop`.
- **Port:** the app keeps the same `127.0.0.1` port from launch to launch, stored in `.port` in that folder. The window's storage (theme, panel layout, the unsaved-draft buffer) belongs to its address, so a new port would start it empty.
- **Signing in:**
  - Each launch makes a random key and gives it to the backend in an environment variable, so it never shows in `ps`.
  - The window opens `/desktop/open?key=…` once, which signs it in as the local admin.
  - The admin password is random and kept in the data folder; nobody types it.
- **Quitting:**
  - The shell sends the backend SIGTERM. The backend shuts down and folds SQLite's write-ahead log into `lorestudio.db`.
  - If the shell dies without that, the backend notices it has been orphaned and stops itself.

### Libraries and tools inside the bundle

- **WeasyPrint's libraries** (Pango, HarfBuzz, fontconfig, GLib) are copied from Homebrew.
  - PyInstaller rewrites each library's links so they load from inside the bundle.
  - WeasyPrint asks for them by bare name, so the entry script points those names at the bundled copies.
  - Fonts come from macOS's own folders through a fontconfig file the backend writes at start.
- **HarfBuzz:** Pillow carries an older copy under the same name. The spec replaces it with Homebrew's, so WeasyPrint's font subsetting loads.
- **Copied in with `ditto`, not as a Tauri resource:** Tauri copies a symlink as a second file, and two copies of one library must never load into one process.
- **pandoc** is the official standalone build, which links only to macOS's system libraries.

## Checking a build

```bash
# The frozen backend on its own, with no Homebrew in sight:
env -i HOME=$HOME PATH=/usr/bin:/bin LORESTUDIO_DESKTOP_KEY=$(openssl rand -hex 32) \
  build/desktop/dist/lorestudio-backend/lorestudio-backend --port 18091 --data-dir /tmp/ls-desktop
python3 desktop/backend/check_exports.py 18091 /tmp/ls-desktop   # exports and spaCy
```

## Not done yet

- **No Developer ID, by choice.** The app is signed ad hoc, so a downloaded copy is approved once in Privacy & Security (above). The signature must stay valid, which is why `just desktop` re-signs after copying the backend in: a broken one reads "damaged", with no Open Anyway. A Developer ID and notarisation can be added in CI later without changing the build.
- **Exports go straight to Downloads.** A native Save dialog is next.
- **Fonts for the interface** still come from Google Fonts, so they fall back to system fonts offline. Bundling them is next.
- **Platforms:** Apple silicon only so far. Intel, Windows and Linux each need their own build of the backend and of WeasyPrint's libraries.
- **No auto-update and no menu bar items** beyond Tauri's defaults.
