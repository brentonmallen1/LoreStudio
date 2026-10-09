"""LoreStudio's backend as the desktop app runs it (macOS, Windows, Linux).

The Tauri shell starts this, frozen by PyInstaller, with:

    lorestudio-backend --port 51234 --data-dir "<the app's data folder>"

and the launch key in the LORESTUDIO_DESKTOP_KEY environment variable (not an argument, so
`ps` never shows it). It serves the API and the built web app on 127.0.0.1 only, keeps
everything in the data folder, signs the window in through /desktop/open?key=…, and stops
cleanly when the shell asks (POST /desktop/quit with the key) or goes away.
"""

import argparse
import hmac
import json
import os
import secrets
import sys
from pathlib import Path

# Inside the frozen app, everything PyInstaller collected sits in sys._MEIPASS; from a
# checkout (for trying this without freezing) the repo's own folders stand in.
FROZEN = getattr(sys, "frozen", False)
BUNDLE = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[2]))
WEB_DIST = BUNDLE / ("web" if FROZEN else "frontend/dist")
BIN_DIR = BUNDLE / "bin"  # pandoc
WINDOWS = sys.platform == "win32"
MACOS = sys.platform == "darwin"
LIBRARY = ".dll" if WINDOWS else ".dylib" if MACOS else ".so"


def _args() -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="lorestudio-backend")
    p.add_argument("--port", type=int, required=True)
    p.add_argument("--data-dir", type=Path, required=True)
    return p.parse_args()


def _kept_secret(path: Path) -> str:
    """A random secret made once and kept in the data folder (sign-ins survive restarts)."""
    if path.exists():
        return path.read_text().strip()
    value = secrets.token_urlsafe(48)
    path.write_text(value)
    path.chmod(0o600)
    return value


def _configure(data: Path, port: int) -> None:
    """Every setting the app reads, before it is imported: config is read at import."""
    data.mkdir(parents=True, exist_ok=True)
    for sub in ("snapshots", "uploads", "backups"):
        (data / sub).mkdir(exist_ok=True)
    os.environ.update(
        {
            "ENV": "prod",
            "INSTALL_KIND": "desktop",
            "DATABASE_URL": f"sqlite:///{(data / 'lorestudio.db').as_posix()}",
            "SNAPSHOTS_PATH": str(data / "snapshots"),
            "UPLOADS_PATH": str(data / "uploads"),
            "BACKUPS_PATH": str(data / "backups"),
            "SECRET_KEY": _kept_secret(data / ".secret_key"),
            # One person on their own computer never types it: the window signs in by key.
            "ADMIN_PASSWORD": _kept_secret(data / ".admin_password"),
            "CORS_ORIGINS": f"http://127.0.0.1:{port}",
        }
    )
    version = BUNDLE / "VERSION"
    if version.is_file():
        os.environ["APP_VERSION"] = version.read_text().strip()
    _fontconfig(data)
    # The bundled pandoc first, so exports and imports never depend on the machine's.
    if BIN_DIR.is_dir():
        os.environ["PATH"] = f"{BIN_DIR}{os.pathsep}{os.environ.get('PATH', '')}"


def _font_folders() -> list[str]:
    home = Path.home()
    if MACOS:
        return ["/System/Library/Fonts", "/Library/Fonts", str(home / "Library/Fonts")]
    if WINDOWS:
        windir = os.environ.get("WINDIR", r"C:\Windows")
        local = os.environ.get("LOCALAPPDATA", str(home / "AppData/Local"))
        return [str(Path(windir) / "Fonts"), str(Path(local) / "Microsoft/Windows/Fonts")]
    return ["/usr/share/fonts", "/usr/local/share/fonts", str(home / ".local/share/fonts"), str(home / ".fonts")]


def _fontconfig(data: Path) -> None:
    """Pango finds fonts through fontconfig, whose bundled copy would look for its settings
    where the build machine kept them. Give it this computer's font folders and a cache in
    the data folder. Each family list names what macOS, Windows and Linux usually have; the
    first one installed wins."""
    conf = data / "fontconfig" / "fonts.conf"
    conf.parent.mkdir(exist_ok=True)
    families = {
        "serif": ["Georgia", "Times New Roman", "DejaVu Serif", "Liberation Serif", "Noto Serif"],
        "sans-serif": ["Helvetica Neue", "Arial", "Segoe UI", "DejaVu Sans", "Liberation Sans", "Noto Sans"],
        "monospace": ["Courier New", "Menlo", "Consolas", "DejaVu Sans Mono", "Liberation Mono"],
    }
    lines = ['<?xml version="1.0"?>', '<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">', "<fontconfig>"]
    lines += [f"  <dir>{folder}</dir>" for folder in _font_folders()]
    lines.append(f"  <cachedir>{conf.parent / 'cache'}</cachedir>")
    for generic, names in families.items():
        prefer = "".join(f"<family>{n}</family>" for n in names)
        lines.append(f"  <alias><family>{generic}</family><prefer>{prefer}</prefer></alias>")
    lines.append("</fontconfig>")
    conf.write_text("\n".join(lines) + "\n", encoding="utf-8")
    os.environ["FONTCONFIG_FILE"] = str(conf)


def _bundled_libraries() -> None:
    """WeasyPrint opens Pango, HarfBuzz, fontconfig and GLib by bare name ("libpango-1.0.dylib",
    "libgobject-2.0-0" on Windows), which the system looks for everywhere but the bundle. Point
    those names at the copies inside it; anything not bundled falls through to the normal search."""
    if not FROZEN:
        return
    if WINDOWS:
        # The DLLs the bundled ones load in turn are found beside them.
        os.add_dll_directory(str(BUNDLE))
    import cffi

    original = cffi.FFI.dlopen

    def dlopen(self, name, flags=0):
        if isinstance(name, str) and not os.path.dirname(name):
            stem = name.removesuffix(LIBRARY)
            # On macOS the versioned file first: it is the one the other libraries link to.
            # Homebrew's "libpango-1.0.dylib" is a link to "libpango-1.0.0.dylib", which the
            # bundle holds as two copies, and loading both would put two Pangos in one process.
            versioned = sorted(BUNDLE.glob(f"{stem}.*{LIBRARY}")) if MACOS else []
            for path in (*versioned, BUNDLE / name, BUNDLE / f"{stem}{LIBRARY}"):
                if path.is_file():
                    return original(self, str(path), flags)
        return original(self, name, flags)

    cffi.FFI.dlopen = dlopen


def _desktop_routes(app, key: str, stop) -> None:
    """The window's way in, the shell's way to stop it, and the web app itself, on the same
    origin as the API."""
    from fastapi import Header, HTTPException, Query
    from fastapi.responses import FileResponse, HTMLResponse
    from sqlalchemy.orm import Session

    from app.auth.utils import create_access_token
    from app.config import settings
    from app.database import engine
    from app.models.user import User

    used = {"open": False}

    @app.get("/desktop/open", include_in_schema=False)
    def desktop_open(given: str = Query("", alias="key")) -> HTMLResponse:
        # Once per launch, and only with the key the shell was started with.
        if used["open"] or not hmac.compare_digest(given, key):
            raise HTTPException(status_code=403)
        used["open"] = True
        with Session(engine) as db:
            user = db.query(User).filter(User.username == settings.admin_username).one()
            token = create_access_token(str(user.id))
        return HTMLResponse(
            "<!doctype html><script>"
            f"localStorage.setItem('ls_token', {json.dumps(token)});"
            "location.replace('/');"
            "</script>"
        )

    @app.post("/desktop/quit", include_in_schema=False)
    def desktop_quit(given: str = Header("", alias="X-LoreStudio-Key")) -> dict:
        # The shell quitting. Windows has no SIGTERM, so every platform asks this way.
        if not hmac.compare_digest(given, key):
            raise HTTPException(status_code=403)
        stop()
        return {"stopping": True}

    index = WEB_DIST / "index.html"
    # The files the build made (scripts, styles, icons), listed once: a requested path is only
    # ever looked up here, never joined onto a folder, so no path can reach outside it.
    built = {f.relative_to(WEB_DIST).as_posix(): f for f in WEB_DIST.rglob("*") if f.is_file()}

    @app.get("/{path:path}", include_in_schema=False)
    def web(path: str):
        # A file the build made, else the app's page: the client routes the rest.
        if path.startswith("api/"):
            raise HTTPException(status_code=404)
        return FileResponse(built.get(path, index))


def _checkpoint_on_shutdown(app) -> None:
    """When the app quits, fold the write-ahead log into the database, so lorestudio.db on its
    own is the whole story for anyone who copies it. Inside the app's own shutdown: uvicorn
    re-raises a stop signal once it has shut down, so nothing after the server would run."""
    from contextlib import asynccontextmanager

    from app.database import engine

    inner = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(a):
        async with inner(a) as state:
            yield state
        with engine.connect() as connection:
            connection.exec_driver_sql("PRAGMA wal_checkpoint(TRUNCATE)")
        engine.dispose()

    app.router.lifespan_context = lifespan


def _stop_with_the_shell(stop) -> None:
    """If the shell goes away without asking us to stop (it crashed, or was killed), stop the
    same clean way. On macOS and Linux this process is handed to a new parent; on Windows it
    is not, so wait on the shell's process itself."""
    import threading
    import time

    shell = os.getppid()

    def watch() -> None:
        if WINDOWS:
            import ctypes

            synchronize, infinite = 0x00100000, 0xFFFFFFFF
            kernel32 = ctypes.windll.kernel32
            handle = kernel32.OpenProcess(synchronize, False, shell)
            if handle:
                kernel32.WaitForSingleObject(handle, infinite)
        else:
            while os.getppid() == shell:
                time.sleep(2)
        stop()

    threading.Thread(target=watch, name="shell-watch", daemon=True).start()


def main() -> None:
    args = _args()
    key = os.environ.pop("LORESTUDIO_DESKTOP_KEY", "")
    if len(key) < 32:
        sys.exit("LORESTUDIO_DESKTOP_KEY is missing or too short")
    _configure(args.data_dir.expanduser(), args.port)
    _bundled_libraries()

    import uvicorn

    from app.main import app

    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=args.port, log_level="info", access_log=False))

    def stop() -> None:
        server.should_exit = True

    _desktop_routes(app, key, stop)
    _stop_with_the_shell(stop)
    _checkpoint_on_shutdown(app)
    server.run()


if __name__ == "__main__":
    main()
