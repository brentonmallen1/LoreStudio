"""The interface and editor fonts, kept in the app rather than fetched from Google Fonts.

A browser that opens LoreStudio asks no one else for anything: the fonts are served with the
app, so they work offline and in the desktop app, and no third party sees who is writing.

    just fonts      # uv run --no-project python scripts/fonts.py

Fetches Google Fonts' stylesheet for FAMILIES once, saves every woff2 it names into
frontend/src/fonts/ under a readable name, rewrites the stylesheet to point at them
(fonts.css, imported by main.tsx) and gathers each family's licence into LICENSES.txt. Same
families, weights and unicode-range subsets as before: a browser downloads only the subsets
the page uses. To add a family or a weight, change FAMILIES and run it again.
"""

from __future__ import annotations

import re
import shutil
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "src" / "fonts"

#: Google Fonts' css2 family specs: the families in the font pickers and the themes.
FAMILIES = [
    "DM+Sans:ital,opsz,wght@0,9..40,300..600;1,9..40,400",
    "Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400",
    "Bitter:ital,wght@0,400;0,500;1,400",
    "Courier+Prime:ital,wght@0,400;0,700;1,400",
    "Cutive",
    "Inter:wght@300;400;500;600",
    "JetBrains+Mono:wght@400;500",
    "Literata:ital,opsz,wght@0,7..72,300;0,7..72,400;1,7..72,300;1,7..72,400",
    "Merriweather:ital,wght@0,300;0,400;1,300;1,400",
    "Noto+Serif:ital,wght@0,400;0,500;1,400",
    "Roboto+Mono:wght@400;500",
    "Space+Mono:ital,wght@0,400;0,700;1,400",
    "Special+Elite",
]

#: Google answers a browser it knows with woff2 and unicode-range subsets.
BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
FACE = re.compile(r"/\* (?P<subset>[\w-]+) \*/\s*@font-face \{(?P<body>.*?)\}", re.S)


def get(url: str, tries: int = 3) -> bytes:
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": BROWSER}), timeout=20) as r:
                return r.read()
        except urllib.error.URLError as e:
            if isinstance(e, urllib.error.HTTPError) or attempt == tries - 1:
                raise
    raise AssertionError("unreachable")


def slug(family: str) -> str:
    return family.lower().replace(" ", "-")


def licence(family: str) -> str:
    """The family's licence from the google/fonts repository: OFL, or Apache for a few."""
    name = family.lower().replace(" ", "")
    for path in (f"ofl/{name}/OFL.txt", f"apache/{name}/LICENSE.txt"):
        try:
            return get(f"https://raw.githubusercontent.com/google/fonts/main/{path}").decode()
        except urllib.error.HTTPError:
            continue
    raise SystemExit(f"No licence found for {family}")


def main() -> None:
    css = get("https://fonts.googleapis.com/css2?" + "&".join(f"family={f}" for f in FAMILIES) + "&display=swap")
    shutil.rmtree(OUT, ignore_errors=True)
    OUT.mkdir(parents=True)
    faces, families, saved = [], [], {}
    for face in FACE.finditer(css.decode()):
        body = face["body"]
        family = re.search(r"font-family: '([^']+)'", body)[1]
        style = re.search(r"font-style: (\w+)", body)[1]
        weight = re.search(r"font-weight: ([\d ]+);", body)[1].replace(" ", "-")
        url = re.search(r"url\((https://[^)]+)\)", body)[1]
        # One variable file often serves several weights: keep it once, under the first name.
        if url not in saved:
            saved[url] = f"{slug(family)}-{style}-{weight}-{face['subset']}.woff2"
            (OUT / saved[url]).write_bytes(get(url))
        name = saved[url]
        faces.append(f"/* {face['subset']} */\n@font-face {{{body.replace(url, './' + name)}}}\n")
        if family not in families:
            families.append(family)
    (OUT / "fonts.css").write_text(
        "/* Made by scripts/fonts.py (`just fonts`) from Google Fonts. Do not edit by hand. */\n" + "".join(faces)
    )
    (OUT / "LICENSES.txt").write_text(
        "The fonts in this folder, served with LoreStudio. Each family's licence follows.\n\n"
        + "\n".join(f"{'=' * 72}\n{family}\n{'=' * 72}\n\n{licence(family)}" for family in families)
    )
    size = sum(f.stat().st_size for f in OUT.glob("*.woff2"))
    print(f"✓ {len(faces)} faces, {len(families)} families, {size / 1e6:.1f} MB in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
