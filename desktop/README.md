# LoreStudio for the desktop

LoreStudio as a desktop app. Releases offer it for **macOS on Apple silicon**; the build also
makes Intel Macs, Windows and Linux, untested so far and not published until there's demand.
It's the same web app the Docker image serves, in its own window, over its own copy of the
backend. Python, WeasyPrint's
libraries, spaCy and its English model, and pandoc are all inside the app. Only Ollama, for
the AI features, is installed separately.

## Build it

The app is built on the platform it's for. Installers land in `build/desktop/out/`:

| Platform | Command | Needs | Makes |
|---|---|---|---|
| macOS (Apple silicon or Intel) | `just desktop` | Rust, Node, uv, `brew install pango` | `LoreStudio_<version>_macos-<arch>.dmg` (about 140 MB) |
| Linux, from any machine with Docker | `just desktop-linux` | Docker | `.AppImage` (about 240 MB) and `.deb` (about 190 MB), for the machine's architecture |
| Windows | `python desktop/build.py` | Rust, Node, uv, MSYS2 with `mingw-w64-ucrt-x86_64-pango`, and `LORESTUDIO_LIBS` set to MSYS2's `ucrt64\bin` | `…_windows-x64-setup.exe` |
| On GitHub | Actions › Desktop apps › Run workflow, or publish a release | | macOS arm64, as an artifact or attached to the release. The Intel, Windows and Linux rows in `desktop.yml` are commented out, ready to switch on |

`just desktop --version 2026.10.3` stamps a release's version. Without one, the build is a
development build ("dev"). `just desktop-backend` rebuilds only the frozen backend.

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

**On Windows**, run the setup `.exe`. SmartScreen may say "Windows protected your PC", because
the app isn't signed with a code-signing certificate. Click **More info**, then **Run anyway**.

**On Linux**, either make the AppImage executable and run it
(`chmod +x LoreStudio_*.AppImage && ./LoreStudio_*.AppImage`), or install the `.deb`
(`sudo apt install ./LoreStudio_*.deb`) on Debian and Ubuntu.

Your stories live outside the app, so installing a new version over an old one keeps them.
They're in `~/Library/Application Support/app.lorestudio.desktop` on macOS,
`%APPDATA%\app.lorestudio.desktop` on Windows, and `~/.local/share/app.lorestudio.desktop`
on Linux.

## How it fits together

| Piece | Where | What it does |
|---|---|---|
| The shell | `src-tauri/src/main.rs` | Tauri 2. Starts the backend, shows `splash/` until it answers, signs the window in, routes downloads and new windows |
| The backend's entry | `backend/lorestudio_desktop.py` | Sets up the data folder, secrets, fonts and bundled libraries, then serves the API and the web app on `127.0.0.1` |
| The freeze | `backend/lorestudio-backend.spec` | PyInstaller, as a folder (one file would unpack itself on every launch) |
| The build | `build.py` (`just desktop`, CI's `desktop.yml`) | Web app, pandoc for the platform, freeze, Tauri, the installers |
| Linux builder | `linux.Dockerfile` (`just desktop-linux`) | Ubuntu 22.04 with Tauri's and Pango's libraries, as CI's runner |

### The shell and the backend

- **One copy at a time.** Opening LoreStudio while it's running brings its window forward. A second copy would start a second backend on the same database.
- **Data:** the database, uploads and backups live in the app's data folder (listed under "Installing a downloaded build" above).
- **Port:** the app keeps the same `127.0.0.1` port from launch to launch, stored in `.port` in that folder. The window's storage (theme, panel layout, the unsaved-draft buffer) belongs to its address, so a new port would start it empty.
- **Signing in:**
  - Each launch makes a random key and gives it to the backend in an environment variable, so it never shows in `ps`.
  - The window opens `/desktop/open?key=…` once, which signs it in as the local admin.
  - The admin password is random and kept in the data folder; nobody types it.
- **Quitting:**
  - The shell asks the backend to stop with `POST /desktop/quit`, which needs the launch key. Windows has no SIGTERM, so every platform uses this.
  - The backend shuts down and folds SQLite's write-ahead log into `lorestudio.db`. If it doesn't stop within 10 seconds, the shell ends it.
  - If the shell dies without asking, the backend notices and stops itself the same way. On macOS and Linux it sees it has been handed to a new parent; on Windows it waits on the shell's process handle.

### Libraries and tools inside the bundle

- **WeasyPrint's libraries** (Pango, HarfBuzz, fontconfig, GLib) are copied from the build machine: Homebrew on macOS, MSYS2's UCRT64 on Windows, the distribution's packages on Linux.
  - PyInstaller copies each one with everything it links to, set to load from inside the bundle.
  - WeasyPrint asks for them by bare name, so the entry script points those names at the bundled copies. On Windows it also adds the bundle to the DLL search path.
- **Fonts** come from the computer's own font folders, through a fontconfig file the backend writes at start. Its serif, sans and mono lists name what each platform usually has; the PDF uses Georgia on macOS and DejaVu Serif on a plain Ubuntu.
- **HarfBuzz on macOS:** Pillow carries an older copy under the same name. The spec replaces it with Homebrew's, so WeasyPrint's font subsetting loads. On Ubuntu 22.04 HarfBuzz is too old for subsetting, and WeasyPrint uses fontTools instead.
- **On macOS the backend is copied in with `ditto`, not as a Tauri resource:** Tauri copies a symlink as a second file, and two copies of one library must never load into one process. Windows and Linux use Tauri's resources; Windows builds have no symlinks, and Linux resolves a library by its name, so it never loads a second copy.
- **pandoc** is the official standalone build for each platform, which links only to the system's own libraries.

## Checking a build

```bash
# The frozen backend on its own, with no Homebrew in sight:
env -i HOME=$HOME PATH=/usr/bin:/bin LORESTUDIO_DESKTOP_KEY=$(openssl rand -hex 32) \
  build/desktop/dist/lorestudio-backend/lorestudio-backend --port 18091 --data-dir /tmp/ls-desktop
python3 desktop/backend/check_exports.py 18091 /tmp/ls-desktop   # exports and spaCy
```

## Not done yet

- **No Developer ID, by choice.** The app is signed ad hoc, so a downloaded copy is approved once in Privacy & Security (above). The signature must stay valid, which is why the build re-signs the app after copying the backend in: a broken one reads "damaged", with no Open Anyway. A Developer ID and notarisation can be added in CI later without changing the build.
- **Exports go straight to Downloads.** A native Save dialog is next.
- **Fonts for the interface** still come from Google Fonts, so they fall back to system fonts offline. Bundling them is next.
- **Tested so far:** macOS on Apple silicon, the whole app. Linux arm64: built in Docker, with the backend from inside the AppImage run on a bare Ubuntu 22.04 (exports and spaCy work); the window itself is untested. Windows and the x64 builds exist only in CI and are untested.
- **No auto-update and no menu bar items** beyond Tauri's defaults.
