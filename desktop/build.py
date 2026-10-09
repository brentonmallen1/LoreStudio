"""Build LoreStudio's desktop app for the platform this runs on (`just desktop`, and CI).

    python desktop/build.py [--version 2026.10.3] [--backend-only]

1. The web app (frontend/dist).
2. pandoc: the official build for this platform, downloaded once into build/desktop/.
3. The backend, frozen by PyInstaller into build/desktop/dist/lorestudio-backend/.
4. The Tauri app around it, and this platform's installers, gathered in build/desktop/out/:
   macOS a .dmg (the backend copied in with ditto, which keeps its symlinks), Windows an
   NSIS setup .exe, Linux an AppImage and a .deb.

WeasyPrint's native libraries come from the build machine, wherever LORESTUDIO_LIBS points:
Homebrew's lib folder on macOS (found by itself), MSYS2's ucrt64\\bin on Windows, and the
system's own on Linux (leave it unset).
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import tarfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build" / "desktop"
OUT = BUILD / "out"
BACKEND_DIST = BUILD / "dist" / "lorestudio-backend"
TAURI = ROOT / "desktop" / "src-tauri"
PANDOC_VERSION = "3.12.1"

MACOS, WINDOWS = sys.platform == "darwin", sys.platform == "win32"
ARCH = {"arm64": "arm64", "aarch64": "arm64", "x86_64": "x64", "amd64": "x64"}[platform.machine().lower()]
TARGET = f"{'macos' if MACOS else 'windows' if WINDOWS else 'linux'}-{ARCH}"


def run(cmd: list[str], cwd: Path = ROOT, env: dict | None = None) -> None:
    print(f"\n$ {' '.join(cmd)}", flush=True)
    # npm and npx are .cmd scripts on Windows, which only the shell runs.
    subprocess.run(cmd, cwd=cwd, env=env, check=True, shell=WINDOWS and cmd[0] in ("npm", "npx"))


def pandoc() -> Path:
    """The official pandoc for this platform: it links only to the system's own libraries."""
    asset = {
        "macos-arm64": "arm64-macOS.zip",
        "macos-x64": "x86_64-macOS.zip",
        "windows-x64": "windows-x86_64.zip",
        "linux-x64": "linux-amd64.tar.gz",
        "linux-arm64": "linux-arm64.tar.gz",
    }[TARGET]
    folder = BUILD / f"pandoc-{PANDOC_VERSION}-{TARGET}"
    name = "pandoc.exe" if WINDOWS else "pandoc"
    found = next(folder.rglob(name), None) if folder.is_dir() else None
    if found:
        return found
    url = f"https://github.com/jgm/pandoc/releases/download/{PANDOC_VERSION}/pandoc-{PANDOC_VERSION}-{asset}"
    archive = BUILD / asset
    BUILD.mkdir(parents=True, exist_ok=True)
    print(f"\nDownloading {url}", flush=True)
    urllib.request.urlretrieve(url, archive)
    if asset.endswith(".zip"):
        with zipfile.ZipFile(archive) as z:
            z.extractall(folder)
    else:
        with tarfile.open(archive) as t:
            t.extractall(folder, filter="data")
    found = next(folder.rglob(name))
    found.chmod(0o755)
    return found


def weasyprint_libraries() -> str:
    if libs := os.environ.get("LORESTUDIO_LIBS"):
        return libs
    if MACOS:
        prefix = subprocess.run(["brew", "--prefix"], capture_output=True, text=True, check=True).stdout.strip()
        return f"{prefix}/lib"
    return ""


def freeze_backend(version: str) -> None:
    run(["npm", "run", "build"], cwd=ROOT / "frontend")
    libs = weasyprint_libraries()
    env = {**os.environ, "LORESTUDIO_PANDOC": str(pandoc()), "LORESTUDIO_LIBS": libs, "LORESTUDIO_VERSION": version}
    if libs and MACOS:
        env["DYLD_FALLBACK_LIBRARY_PATH"] = libs  # where the WeasyPrint hook looks
    elif libs and WINDOWS:
        env["PATH"] = f"{libs}{os.pathsep}{env['PATH']}"
    run(
        [
            "uv",
            "run",
            "--group",
            "desktop",
            "pyinstaller",
            str(ROOT / "desktop/backend/lorestudio-backend.spec"),
            "--noconfirm",
            "--distpath",
            str(BUILD / "dist"),
            "--workpath",
            str(BUILD / "work"),
            "--log-level",
            "WARN",
        ],
        cwd=ROOT / "backend",
        env=env,
    )


def build_app(version: str) -> None:
    run(["npm", "install", "--no-audit", "--no-fund"], cwd=ROOT / "desktop")
    # Tauri wants semver: a release's CalVer is one (2026.10.3); anything else builds as 0.0.0.
    config: dict = {"version": version if version != "dev" else "0.0.0"}
    bundles = "app" if MACOS else "nsis" if WINDOWS else "appimage,deb"
    if not MACOS:
        # Tauri carries the backend as a resource here. (On macOS it goes in afterwards with
        # ditto: Tauri copies a symlink as a second file, and two copies of one library must
        # never load into one process. Windows builds have no symlinks; Linux resolves a
        # library by its soname, so a second copy is never loaded for it.)
        config["bundle"] = {"resources": {BACKEND_DIST.as_posix() + "/": "backend/"}}
    # A file, not JSON on the command line: on Windows that passes through cmd.exe's quoting.
    override = BUILD / "tauri.override.json"
    override.write_text(json.dumps(config))
    run(["npx", "tauri", "build", "--bundles", bundles, "--config", str(override)], cwd=ROOT / "desktop")

    bundle = TAURI / "target" / "release" / "bundle"
    OUT.mkdir(parents=True, exist_ok=True)
    stem = f"LoreStudio_{version}_{TARGET}"
    if MACOS:
        app = bundle / "macos" / "LoreStudio.app"
        backend = app / "Contents" / "Resources" / "backend"
        shutil.rmtree(backend, ignore_errors=True)
        run(["ditto", str(BACKEND_DIST), str(backend)])
        run(["codesign", "--force", "--deep", "--sign", "-", str(app)])
        stage = BUILD / "dmg"
        shutil.rmtree(stage, ignore_errors=True)
        stage.mkdir(parents=True)
        run(["ditto", str(app), str(stage / "LoreStudio.app")])
        (stage / "Applications").symlink_to("/Applications")
        dmg = OUT / f"{stem}.dmg"
        dmg.unlink(missing_ok=True)
        run(
            [
                "hdiutil",
                "create",
                "-quiet",
                "-volname",
                "LoreStudio",
                "-srcfolder",
                str(stage),
                "-format",
                "UDZO",
                str(dmg),
            ]
        )
    elif WINDOWS:
        for exe in (bundle / "nsis").glob("*.exe"):
            shutil.copy2(exe, OUT / f"{stem}-setup.exe")
    else:
        for image in (bundle / "appimage").glob("*.AppImage"):
            shutil.copy2(image, OUT / f"{stem}.AppImage")
        for deb in (bundle / "deb").glob("*.deb"):
            shutil.copy2(deb, OUT / f"{stem}.deb")
    for made in sorted(OUT.glob(f"{stem}*")):
        print(f"✓ {made.relative_to(ROOT)} ({made.stat().st_size / 1e6:.0f} MB)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--version", default=os.environ.get("LORESTUDIO_VERSION", "dev"), help="a release: 2026.10.3")
    parser.add_argument("--backend-only", action="store_true", help="freeze the backend, build no app")
    args = parser.parse_args()
    freeze_backend(args.version)
    if not args.backend_only:
        build_app(args.version)


if __name__ == "__main__":
    main()
