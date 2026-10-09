"""LoreStudio's backend as the desktop app runs it (macOS proof of concept).

The Tauri shell starts this, frozen by PyInstaller, with:

    lorestudio-backend --port 51234 --data-dir "~/Library/Application Support/…"

and the launch key in the LORESTUDIO_DESKTOP_KEY environment variable (not an argument, so
`ps` never shows it). It serves the API and the built web app on 127.0.0.1 only, keeps
everything in the data folder, and signs the window in through /desktop/open?key=….
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
            "DATABASE_URL": f"sqlite:///{data / 'lorestudio.db'}",
            "SNAPSHOTS_PATH": str(data / "snapshots"),
            "UPLOADS_PATH": str(data / "uploads"),
            "BACKUPS_PATH": str(data / "backups"),
            "SECRET_KEY": _kept_secret(data / ".secret_key"),
            # One person on their own computer never types it: the window signs in by key.
            "ADMIN_PASSWORD": _kept_secret(data / ".admin_password"),
            "CORS_ORIGINS": f"http://127.0.0.1:{port}",
        }
    )
    _fontconfig(data)
    # The bundled pandoc first, so exports and imports never depend on the machine's.
    if BIN_DIR.is_dir():
        os.environ["PATH"] = f"{BIN_DIR}{os.pathsep}{os.environ.get('PATH', '')}"


def _fontconfig(data: Path) -> None:
    """Pango finds fonts through fontconfig, whose bundled copy would look for its settings
    where Homebrew keeps them. Give it macOS's own font folders and a cache in the data folder."""
    conf = data / "fontconfig" / "fonts.conf"
    conf.parent.mkdir(exist_ok=True)
    conf.write_text(
        '<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">\n<fontconfig>\n'
        "  <dir>/System/Library/Fonts</dir>\n  <dir>/Library/Fonts</dir>\n  <dir>~/Library/Fonts</dir>\n"
        f"  <cachedir>{conf.parent / 'cache'}</cachedir>\n"
        "  <alias><family>serif</family><prefer><family>Georgia</family><family>Times</family></prefer></alias>\n"
        "  <alias><family>sans-serif</family><prefer><family>Helvetica Neue</family></prefer></alias>\n"
        "  <alias><family>monospace</family><prefer><family>Courier New</family><family>Menlo</family></prefer></alias>\n"
        "</fontconfig>\n"
    )
    os.environ["FONTCONFIG_FILE"] = str(conf)


def _bundled_libraries() -> None:
    """WeasyPrint opens Pango, HarfBuzz, fontconfig and GLib by bare name ("libpango-1.0.dylib"),
    which macOS only finds through DYLD_* search paths. Point those names at the copies inside
    the bundle instead; anything not bundled falls through to the normal search."""
    if not FROZEN:
        return
    import cffi

    original = cffi.FFI.dlopen

    def dlopen(self, name, flags=0):
        if isinstance(name, str) and "/" not in name:
            stem = name.removesuffix(".dylib")
            # The versioned file first: it is the one the other libraries link to. Homebrew's
            # "libpango-1.0.dylib" is a link to "libpango-1.0.0.dylib", which the bundle holds
            # as two copies, and loading both would put two Pangos in one process.
            for path in (*sorted(BUNDLE.glob(f"{stem}.*.dylib")), BUNDLE / name, BUNDLE / f"{stem}.dylib"):
                if path.is_file():
                    return original(self, str(path), flags)
        return original(self, name, flags)

    cffi.FFI.dlopen = dlopen


def _desktop_routes(app, key: str) -> None:
    """The window's way in, and the web app itself, on the same origin as the API."""
    from fastapi import HTTPException, Query
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

    index = WEB_DIST / "index.html"

    @app.get("/{path:path}", include_in_schema=False)
    def web(path: str):
        # A file the build made (scripts, styles, icons), else the app's page: the client routes.
        if path.startswith("api/"):
            raise HTTPException(status_code=404)
        target = (WEB_DIST / path).resolve()
        if path and target.is_file() and WEB_DIST.resolve() in target.parents:
            return FileResponse(target)
        return FileResponse(index)


def _checkpoint_on_shutdown(app) -> None:
    """When the app quits, fold the write-ahead log into the database, so lorestudio.db on its
    own is the whole story for anyone who copies it. Inside the app's own shutdown: uvicorn
    re-raises the stop signal once it has shut down, so nothing after uvicorn.run would run."""
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


def _stop_with_the_shell() -> None:
    """Quitting the app stops this process (SIGTERM). If the shell dies without saying so,
    this process is handed to launchd: notice, and stop the same clean way."""
    import signal
    import threading
    import time

    shell = os.getppid()

    def watch() -> None:
        while os.getppid() == shell:
            time.sleep(2)
        os.kill(os.getpid(), signal.SIGTERM)

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

    _desktop_routes(app, key)
    _stop_with_the_shell()
    _checkpoint_on_shutdown(app)
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info", access_log=False)


if __name__ == "__main__":
    main()
