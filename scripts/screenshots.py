"""The README's screenshots, taken from the demo stories (doc 23 P7b).

Starts its own API and Vite on spare ports against a throwaway database seeded with every
demo (the Lighthouse, its sequel and their series), runs the local checks so Findings has
something to show, then photographs each page in light and dark with Chrome. Nothing of yours
is read or written. Run with `just screenshots`; it rewrites docs/images/screenshots/.

    uv run --no-project --with playwright python scripts/screenshots.py
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/images/screenshots"
API, WEB = 8797, 5297
PASSWORD = "screenshots-only"
VIEWPORT = {"width": 1440, "height": 900}


def call(path: str, token: str | None = None, body: dict | None = None):
    req = urllib.request.Request(
        f"http://127.0.0.1:{API}/api{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})},
        method="POST" if body is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def wait_for(url: str, seconds: int = 120) -> None:
    for _ in range(seconds):
        try:
            urllib.request.urlopen(url, timeout=2)
            return
        except Exception:
            time.sleep(1)
    sys.exit(f"Nothing answered at {url}")


def start(data: Path, procs: list[subprocess.Popen]) -> None:
    """Start the API and Vite, adding each to `procs` as it starts (so a failure still stops them)."""
    env = {
        **os.environ,
        "ENV": "dev",
        "DATABASE_URL": f"sqlite:///{data}/lorestudio.db",
        "SNAPSHOTS_PATH": str(data / "snapshots"),
        "UPLOADS_PATH": str(data / "uploads"),
        "BACKUPS_PATH": str(data / "backups"),
        "ADMIN_USERNAME": "admin",
        "ADMIN_PASSWORD": PASSWORD,
        "SEED_DEMO": "true",
        "SEED_EXTRA_DEMOS": "true",
        "PORT": str(API),
        "FRONTEND_PORT": str(WEB),
    }
    if sys.platform == "darwin":
        env["DYLD_LIBRARY_PATH"] = "/opt/homebrew/lib"  # WeasyPrint's Pango, as `just backend` does
    log = open(data / "servers.log", "w")
    procs.append(
        subprocess.Popen(
            ["uv", "run", "python", "-m", "uvicorn", "app.main:app", "--port", str(API)],
            cwd=ROOT / "backend",
            env=env,
            stdout=log,
            stderr=log,
        )
    )
    procs.append(
        subprocess.Popen(
            ["npx", "vite", "--host", "127.0.0.1", "--port", str(WEB), "--strictPort"],
            cwd=ROOT / "frontend",
            env=env,
            stdout=log,
            stderr=log,
        )
    )
    wait_for(f"http://127.0.0.1:{API}/health")
    wait_for(f"http://127.0.0.1:{WEB}/")


def pages(token: str) -> list[tuple[str, str, bool]]:
    """(name, path, panel open) for each page worth showing."""
    stories = {s["title"]: s for s in call("/stories", token)}
    sid = stories["The Last Lighthouse"]["id"]
    tree = call(f"/stories/{sid}/structure", token)
    flat = []

    def walk(nodes):
        for n in nodes:
            flat.append(n)
            walk(n.get("children") or [])

    walk(tree if isinstance(tree, list) else tree.get("nodes", []))
    scene = next(n for n in flat if n.get("title") == "The Light")
    eleanor = next(c for c in call(f"/stories/{sid}/characters", token) if c["name"] == "Eleanor Vance")
    series = call("/series", token)[0]["id"]
    # Findings worth reading: the local checks, as a writer would run them.
    call(f"/stories/{sid}/findings/local-checks", token, {})
    for _ in range(90):
        jobs = call("/jobs", token)
        if all(j["status"] in ("done", "failed", "cancelled") for j in jobs if j["kind"] == "local-checks"):
            break
        time.sleep(1)
    s = f"/stories/{sid}"
    return [
        ("dashboard", "/", False),
        ("write", f"{s}/write/{scene['id']}", True),
        ("overview", s, False),
        ("findings", f"{s}/findings", False),
        ("character", f"{s}/lorebook/characters/{eleanor['id']}", False),
        ("promises", f"{s}/promises", False),
        ("numbers", f"{s}/numbers", False),
        ("series-plan", f"/series/{series}/plan", False),
    ]


def shoot(token: str, shots: list[tuple[str, str, bool]]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome")
        except Exception:
            browser = p.chromium.launch()
        for mode in ("light", "dark"):
            ctx = browser.new_context(viewport=VIEWPORT, color_scheme=mode)
            for name, path, panel in shots:
                page = ctx.new_page()
                page.add_init_script(
                    "try {"
                    f" localStorage.setItem('ls_token', '{token}');"
                    f" localStorage.setItem('ls_color_mode', '{mode}');"
                    " localStorage.setItem('ls_theme', 'zen');"
                    f" localStorage.setItem('ls_panel_shown', '{json.dumps(panel)}');"
                    " } catch (e) {}"
                )
                page.goto(f"http://127.0.0.1:{WEB}{path}")
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(1500)
                page.screenshot(path=str(OUT / f"{name}-{mode}.png"))
                page.close()
                print(f"  {name}-{mode}.png")
            ctx.close()
        browser.close()


def optimise() -> None:
    tool = shutil.which("oxipng") or shutil.which("pngquant")
    if not tool:
        print("(oxipng or pngquant would make these smaller)")
        return
    files = [str(f) for f in OUT.glob("*.png")]
    if tool.endswith("oxipng"):
        subprocess.run([tool, "-o", "3", "--strip", "safe", "-q", *files], check=False)
    else:
        subprocess.run([tool, "--force", "--ext", ".png", "--quality", "70-90", *files], check=False)


def main() -> None:
    data = Path(tempfile.mkdtemp(prefix="lorestudio-shots-"))
    procs: list[subprocess.Popen] = []
    try:
        start(data, procs)
        token = call("/auth/login", body={"username": "admin", "password": PASSWORD})["access_token"]
        shoot(token, pages(token))
        optimise()
    finally:
        for proc in procs:
            proc.terminate()
        for proc in procs:
            proc.wait(timeout=20)
        shutil.rmtree(data, ignore_errors=True)
    print(f"Screenshots in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
