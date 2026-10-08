"""Every logo and icon file, made from one master: docs/images/lorestudio-logo.svg.

Change the master (its single path, its viewBox square around the mark) and run `just icons`.
The master follows the reader's theme by itself (dark ink, or paper on a dark background); the
rest are fixed versions for where a theme cannot be asked:

    docs/images/lorestudio-logo-light.svg/.png   dark ink, for light backgrounds (README)
    docs/images/lorestudio-logo-dark.svg/.png    paper, for dark backgrounds (README)
    docs/images/lorestudio-icon.png              on a parchment tile (Unraid; any unknown ground)
    frontend/public/favicon.svg                  the master: the browser tab follows the theme
    frontend/public/favicon.ico                  16/32/48, for browsers without SVG favicons
    frontend/public/apple-touch-icon.png         180, full-bleed tile (iOS rounds it, and fills
                                                 transparency with black)
    frontend/public/icon-192.png, icon-512.png   tiles for the web app manifest
    frontend/public/icon-maskable-512.png        the mark inside Android's safe zone

    uv run --no-project --with pillow python scripts/icons.py
"""

import io
import re
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "docs/images/lorestudio-logo.svg"
DOCS = ROOT / "docs/images"
PUBLIC = ROOT / "frontend/public"

INK, PAPER, TILE = "#1a1916", "#f0ede6", "#f7f6f3"  # DESIGN.md: ink, dark text, parchment


def master() -> tuple[str, list[float]]:
    svg = MASTER.read_text()
    d = re.search(r'<path[^>]* d="([^"]+)"', svg).group(1)
    box = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
    return d, box


def svg(d: str, box: list[float], fill: str, *, tile: str | None = None, scale: float = 1.0, radius: float = 0) -> str:
    """The mark in `fill`, alone or centred on a square tile at `scale` of its side."""
    x, y, side, _ = box
    title = "<title>LoreStudio</title>"
    if tile is None:
        body = f'<path fill="{fill}" fill-rule="evenodd" d="{d}"/>'
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {side} {side}" role="img" aria-label="LoreStudio">{title}{body}</svg>\n'
    inset = side * (1 - scale) / 2
    mark = (
        f'<g transform="translate({x + inset} {y + inset}) scale({scale}) translate({-x} {-y})">'
        f'<path fill="{fill}" fill-rule="evenodd" d="{d}"/></g>'
    )
    bg = f'<rect x="{x}" y="{y}" width="{side}" height="{side}" rx="{side * radius}" fill="{tile}"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {side} {side}">{title}{bg}{mark}</svg>\n'


def png(source: str, size: int) -> Image.Image:
    out = subprocess.run(
        ["rsvg-convert", "-w", str(size), "-h", str(size)], input=source.encode(), capture_output=True, check=True
    ).stdout
    return Image.open(io.BytesIO(out)).convert("RGBA")


def save(img: Image.Image, path: Path) -> None:
    img.save(path, optimize=True)
    print(f"  {path.relative_to(ROOT)}")


def main() -> None:
    d, box = master()
    PUBLIC.mkdir(parents=True, exist_ok=True)
    light, dark = svg(d, box, INK), svg(d, box, PAPER)
    for name, source in (("light", light), ("dark", dark)):
        (DOCS / f"lorestudio-logo-{name}.svg").write_text(source)
        print(f"  docs/images/lorestudio-logo-{name}.svg")
        save(png(source, 512), DOCS / f"lorestudio-logo-{name}.png")

    rounded = svg(d, box, INK, tile=TILE, scale=0.72, radius=0.22)
    full = svg(d, box, INK, tile=TILE, scale=0.72)
    maskable = svg(d, box, INK, tile=TILE, scale=0.58)  # inside the 80% safe circle
    save(png(rounded, 512), DOCS / "lorestudio-icon.png")

    (PUBLIC / "favicon.svg").write_text(MASTER.read_text())
    print("  frontend/public/favicon.svg")
    png(light, 256).save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("  frontend/public/favicon.ico")
    save(png(full, 180), PUBLIC / "apple-touch-icon.png")
    save(png(rounded, 192), PUBLIC / "icon-192.png")
    save(png(rounded, 512), PUBLIC / "icon-512.png")
    save(png(maskable, 512), PUBLIC / "icon-maskable-512.png")


if __name__ == "__main__":
    main()
