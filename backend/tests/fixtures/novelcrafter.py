"""A small Novelcrafter "full" export, made in the test: the shape of a real one, none of its words.

``make_export()`` builds the zip; ``docx`` is made by pandoc when the test needs a manuscript
(``manuscript=True``), else a placeholder the reader never opens.
"""

from __future__ import annotations

import io
import json
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64

MANUSCRIPT = """# Opening Image

## Fade In:

Night on the beach. A fire.

# Act 1: The Crime

## Chapter 1: Scene 1: Lay of the Land

The keeper feeds his livestock before dawn.

* * *

Life at the station.

## Chapter 2: Scene 2: The Superintendent Arrives

The superintendent walks up the beach.

* * *

INT. INSPECTOR'S OFFICE - DAY

NEWCOMB (looking up) We are hitting a wall.

RICHARD So, they get away with it?

CUT TO:
"""


def pandoc_available() -> bool:
    return shutil.which("pandoc") is not None


def _docx(markdown: str) -> bytes:
    with tempfile.TemporaryDirectory() as d:
        out = Path(d) / "novel.docx"
        subprocess.run(["pandoc", "-f", "markdown", "-t", "docx", "-o", str(out)], input=markdown.encode(), check=True)
        return out.read_bytes()


def _entry(kind: str, eid: str, name: str, body: str = "", **attrs) -> dict[str, bytes]:
    folder = f"{kind}/{name.lower().replace(' ', '-').replace('.', '').replace(':', '')}-{eid}"
    meta = {
        "id": eid,
        "attributes": {
            "type": attrs.pop("type", kind.rstrip("s").replace("subplot", "subplot")),
            "name": name,
            "color": attrs.pop("color", None),
            "aliases": attrs.pop("aliases", []),
            "tags": attrs.pop("tags", []),
            "alwaysIncludeInContext": attrs.pop("always", False),
            "doNotTrack": False,
            "noAutoInclude": False,
        },
        "relationships": {"nestedEntries": attrs.pop("nested", [])},
        "links": {"externalReferences": attrs.pop("urls", [])},
    }
    fields = attrs.pop("fields", {})
    front = "fields: {}" if not fields else "fields:\n" + "\n".join(f"  {k}: {v}" for k, v in fields.items())
    files = {
        f"{folder}/metadata.json": json.dumps(meta).encode(),
        f"{folder}/entry.md": f"---\ntype: {meta['attributes']['type']}\nname: {name}\n{front}\n---\n{body}".encode(),
    }
    if attrs.pop("thumbnail", False):
        files[f"{folder}/thumbnail.jpg"] = JPEG
    if notes := attrs.pop("notes", ""):
        files[f"{folder}/notes.md"] = notes.encode()
    return files


def make_export(*, manuscript: bool = False, favourite: bool = False, extra: dict[str, bytes] | None = None) -> bytes:
    files: dict[str, bytes] = {}
    files["novel.docx"] = _docx(MANUSCRIPT) if manuscript else b"not opened"
    for part in (
        _entry(
            "characters",
            "c1",
            "Richard Etheridge",
            "Stoic.",
            type="character",
            tags=["Protagonist", "Hero"],
            nested=["o1"],
            thumbnail=True,
            urls=["https://en.wikipedia.org/wiki/Pea_Island_Life-Saving_Station"],
        ),
        _entry(
            "characters", "c2", "Frank H. Newcomb", "An inspector.", type="character", aliases=["Newcomb", "Inspector"]
        ),
        _entry("other", "o1", "Richard (Physical)", "Tall, with a graying goatee.", thumbnail=True),
        _entry("other", "o2", "Newcomb (Emotion)", "Guarded, then warmer."),
        _entry("other", "o3", "Richard (Monologue)", "I have spent my life proving it."),
        _entry("other", "o4", "Noble Bigot with a Badge", "A bigot written sympathetically.", tags=["Trope"]),
        _entry("other", "o5", "White Supremacy is flawed", "The story's claim.", tags=["Theme"]),
        _entry("locations", "l1", "Station No. 17", "The station.", type="location", aliases=["Pea Island", "17"]),
        _entry("locations", "l2", "Pea Island", "The island.", type="location", tags=["OBX"]),
        _entry("lore", "r1", "Station 17: Pea Island", "Its history.", type="lore", thumbnail=True),
        _entry(
            "lore",
            "r2",
            "The Lifesaving Service",
            "Founded in 1871.",
            type="lore",
            tags=["Lifesaving Service"],
            urls=["https://example.org/lss"],
            notes="Kimball ran it.",
        ),
        _entry("subplots", "s1", "The fire at Station 17", "Who set it?", type="subplot", aliases=["Fire"]),
    ):
        files.update(part)
    files["snippets/2024-07-28 logline - 2jtcAxi8.md"] = (
        b"---\ntitle: Logline\nfavourite: false\n---\nA keeper rebuilds."
    )
    files["snippets/2024-08-01 the-wreck - 2k4j9yxz.md"] = (
        b"---\ntitle: The Wreck\nfavourite: false\n---\nhttps://example.org/wreck\n"
    )
    files["snippets/2024-07-22 2jc8r8zA.md"] = (
        f'---\ntitle: ""\nfavourite: {"true" if favourite else "false"}\n---\nMending nets as a metaphor.'.encode()
    )
    files["chats/2024-07-30 2jtS4R24.md"] = (
        b'---\ntitle: ""\nfavourite: false\n---\n## User\nGive me a summary\n\n## AI\nHere is one.\n\n## User\nThanks\n\n## AI\nGlad to help.'
    )
    files["codex.html"] = b"<html></html>"
    files.update(extra or {})
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, data in files.items():
            zf.writestr(name, data)
    return buf.getvalue()
