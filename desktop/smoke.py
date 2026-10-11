"""Smoke-test the frozen backend the way the shell runs it, with no window (`just desktop-smoke`, CI).

    python desktop/smoke.py [--port 18091]

Starts build/desktop/dist/lorestudio-backend/ on a fresh data folder with a launch key, waits
for it to answer, runs desktop/backend/check_exports.py (exports through WeasyPrint and pandoc,
spaCy), then asks it to quit as the shell does and checks it stops on its own. Exits 1 on any
failure, printing the backend's output.
"""

from __future__ import annotations

import argparse
import os
import secrets
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "build" / "desktop" / "dist" / "lorestudio-backend"
#: A first start migrates and seeds the database, on a slow CI runner.
START_LIMIT = 300
STOP_LIMIT = 30


def answers(url: str, key: str | None = None) -> bool:
    req = urllib.request.Request(url, method="POST" if key else "GET", data=b"" if key else None)
    if key:
        req.add_header("X-LoreStudio-Key", key)
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            return res.status == 200
    except OSError:
        return False


def main() -> None:
    # The ✓ and ✗ below: a Windows console is cp1252 by default, which has neither.
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--port", type=int, default=18091)
    port = parser.parse_args().port
    exe = BACKEND / ("lorestudio-backend.exe" if sys.platform == "win32" else "lorestudio-backend")
    key = secrets.token_hex(32)
    base = f"http://127.0.0.1:{port}"
    data = Path(tempfile.mkdtemp(prefix="lorestudio-smoke-"))
    log = data.parent / f"{data.name}.log"

    with log.open("w") as out:
        # Only the system's own paths: nothing from the build machine may be found by accident.
        # With no stdout, as a windowed app's child may have (closed here where it can be: not
        # on Windows); stderr, where the logging goes, is kept to show a failure.
        backend = subprocess.Popen(
            [str(exe), "--port", str(port), "--data-dir", str(data)],
            env={**minimal_env(), "LORESTUDIO_DESKTOP_KEY": key},
            stdout=out,
            stderr=out,
            preexec_fn=None if sys.platform == "win32" else lambda: os.close(1),  # noqa: PLW1509
        )
    try:
        started = time.monotonic()
        while not answers(f"{base}/api/health"):
            if backend.poll() is not None:
                fail(f"the backend exited with {backend.returncode} before answering", log)
            if time.monotonic() - started > START_LIMIT:
                fail(f"the backend did not answer within {START_LIMIT}s", log)
            time.sleep(1)
        print(f"✓ answered after {time.monotonic() - started:.0f}s", flush=True)

        check = subprocess.run([sys.executable, str(ROOT / "desktop/backend/check_exports.py"), str(port), str(data)])
        if check.returncode:
            fail("the export check failed", log)

        if not answers(f"{base}/desktop/quit", key):
            fail("POST /desktop/quit was refused", log)
        try:
            backend.wait(STOP_LIMIT)
        except subprocess.TimeoutExpired:
            fail(f"the backend did not stop within {STOP_LIMIT}s of being asked", log)
        if (data / "lorestudio.db-wal").exists() and (data / "lorestudio.db-wal").stat().st_size:
            fail("the write-ahead log was not folded into the database on the way out", log)
        print("✓ stopped when asked, database checkpointed")
    finally:
        if backend.poll() is None:
            backend.kill()


def minimal_env() -> dict[str, str]:
    keep = ("HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "TMPDIR")
    env = {k: v for k, v in os.environ.items() if k in keep}
    if sys.platform == "win32":
        root = os.environ.get("SYSTEMROOT", r"C:\Windows")
        env["PATH"] = rf"{root}\System32;{root}"
    else:
        env["PATH"] = "/usr/bin:/bin"
    return env


def fail(why: str, log: Path) -> None:
    print(f"\n✗ {why}. The backend's output:\n", flush=True)
    print(log.read_text(errors="replace")[-20000:])
    sys.exit(1)


if __name__ == "__main__":
    main()
