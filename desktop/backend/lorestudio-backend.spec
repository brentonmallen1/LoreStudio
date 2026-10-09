# PyInstaller recipe for the desktop app's backend (macOS proof of concept).
#
# A folder, not one file: a single-file build unpacks itself into a temporary folder on every
# launch. Built by `just desktop-backend`; the Tauri shell carries the folder as a resource.
#
# WeasyPrint's native libraries (Pango, HarfBuzz, fontconfig, GLib) come from Homebrew: the
# contrib hook finds them when DYLD_FALLBACK_LIBRARY_PATH includes /opt/homebrew/lib, and
# PyInstaller copies each with everything it links to, rewritten to load from the bundle.
import os
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_dynamic_libs, collect_submodules

ROOT = Path(SPECPATH).resolve().parents[1]  # noqa: F821 — PyInstaller defines SPECPATH
BACKEND = ROOT / "backend"
WEB = ROOT / "frontend" / "dist"
PANDOC = os.environ.get("LORESTUDIO_PANDOC", "")

datas = [
    (str(BACKEND / "alembic.ini"), "."),
    (str(BACKEND / "alembic"), "alembic"),
    (str(BACKEND / "app" / "assets"), "app/assets"),
    (str(WEB), "web"),
]
binaries = collect_dynamic_libs("sqlite_vec")
if PANDOC:
    binaries.append((PANDOC, "bin"))
hiddenimports = [
    *collect_submodules("app"),
    "logging.config",  # alembic/env.py
    "python_multipart",  # FastAPI imports it lazily for uploads
]

# spaCy finds its parts through registries and package metadata, which no import shows.
for package in (
    "spacy",
    "spacy_legacy",
    "spacy_loggers",
    "thinc",
    "en_core_web_sm",
    "srsly",
    "catalogue",
    "confection",
    "weasel",
):
    d, b, h = collect_all(package)
    datas += d
    binaries += b
    hiddenimports += h

a = Analysis(  # noqa: F821
    [str(ROOT / "desktop" / "backend" / "lorestudio_desktop.py")],
    pathex=[str(BACKEND)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    excludes=["tkinter", "pytest", "IPython", "matplotlib"],
    noarchive=False,
)
# Pillow carries its own, older HarfBuzz under the same name, and only one is kept. Homebrew's
# HarfBuzz-Subset (WeasyPrint's font subsetting) needs the newer one, which Pillow accepts too.
HARFBUZZ = Path("/opt/homebrew/lib/libharfbuzz.0.dylib").resolve()
if HARFBUZZ.exists():
    a.binaries = [
        (dest, str(HARFBUZZ) if Path(dest).name == "libharfbuzz.0.dylib" else src, kind)
        for dest, src, kind in a.binaries
    ]

pyz = PYZ(a.pure)  # noqa: F821
exe = EXE(  # noqa: F821
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="lorestudio-backend",
    console=True,
    upx=False,
    target_arch="arm64",
)
coll = COLLECT(exe, a.binaries, a.datas, upx=False, name="lorestudio-backend")  # noqa: F821
