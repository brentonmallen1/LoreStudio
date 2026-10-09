# PyInstaller recipe for the desktop app's backend (macOS, Windows, Linux).
#
# A folder, not one file: a single-file build unpacks itself into a temporary folder on every
# launch. Built by desktop/build.py (`just desktop`), always on the platform it is for.
#
# WeasyPrint's native libraries (Pango, HarfBuzz, fontconfig, GLib) come from the build
# machine: Homebrew on macOS, MSYS2's UCRT64 on Windows, the distribution on Linux. The
# contrib hook finds them (build.py puts their folder on the search path) and PyInstaller
# copies each with everything it links to, set to load from the bundle.
import os
import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_dynamic_libs, collect_submodules

ROOT = Path(SPECPATH).resolve().parents[1]  # noqa: F821 — PyInstaller defines SPECPATH
BACKEND = ROOT / "backend"
WEB = ROOT / "frontend" / "dist"
PANDOC = os.environ.get("LORESTUDIO_PANDOC", "")
#: Where the build found WeasyPrint's libraries (Homebrew's lib folder on macOS).
LIBS = os.environ.get("LORESTUDIO_LIBS", "")
#: The release this is, read by the backend at start (Settings › About and updates).
VERSION = ROOT / "build" / "desktop" / "VERSION"
VERSION.parent.mkdir(parents=True, exist_ok=True)
VERSION.write_text(os.environ.get("LORESTUDIO_VERSION", "dev"))

datas = [
    (str(BACKEND / "alembic.ini"), "."),
    (str(BACKEND / "alembic"), "alembic"),
    (str(BACKEND / "app" / "assets"), "app/assets"),
    (str(WEB), "web"),
    (str(VERSION), "."),
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
HARFBUZZ = (Path(LIBS) / "libharfbuzz.0.dylib").resolve() if LIBS else None
if sys.platform == "darwin" and HARFBUZZ and HARFBUZZ.exists():
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
)
coll = COLLECT(exe, a.binaries, a.datas, upx=False, name="lorestudio-backend")  # noqa: F821
