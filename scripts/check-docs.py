#!/usr/bin/env python3
"""Tracked documents: what ships is what a reader of the repo should read (doc 23 D5).

Reviews, prompts, planning notes and scratch writing belong in `notes/`, which git ignores.
They used to land at the root (CHAT_REVIEW.md, original_notes.md) and stay there, so every
markdown file git tracks must be one of the documents below or live in a folder meant for them.
A new one fails here with where to put it; one that should ship is added to the list.

It also follows every relative link and image in those documents (not the in-app guides, whose
links are app routes): a moved or renamed file breaks the README quietly otherwise.
"""

import re
import subprocess
import sys
from pathlib import Path

#: Documents a reader is meant to find: the root's, and the note on the shared test fixtures.
ROOT = {"README.md", "CLAUDE.md", "DESIGN.md", "CONTRIBUTING.md", "shared/README.md"}
#: Folders whose markdown ships: the docs, the in-app guides, the Unraid notes, GitHub's files.
FOLDERS = ("docs/", "frontend/src/guides/", "unraid/", ".github/")


#: Markdown links and HTML src/href (the README's header and screenshots are HTML).
LINK = re.compile(r"\]\(([^)\s]+)\)|(?:src|href|srcset)=\"([^\"]+)\"")
EXTERNAL = ("http://", "https://", "mailto:", "#")


def broken_links(paths: list[str]) -> list[str]:
    out = []
    for p in paths:
        if p.startswith("frontend/src/guides/"):
            continue
        for m in LINK.finditer(Path(p).read_text(encoding="utf-8")):
            target = (m.group(1) or m.group(2)).split("#")[0]
            if not target or target.startswith(EXTERNAL):
                continue
            if not (Path(p).parent / target).exists():
                out.append(f"{p} → {target}")
    return out


def main() -> int:
    tracked = subprocess.run(
        ["git", "ls-files", "--", "*.md", "*.markdown"], capture_output=True, text=True, check=True
    ).stdout.split()
    stray = [p for p in tracked if p not in ROOT and not p.startswith(FOLDERS)]
    if stray:
        print("Markdown tracked outside the documents that ship:\n")
        for p in stray:
            print(f"  · {p}")
        print(
            "\nDevelopment notes, reviews and plans go in notes/ (gitignored): "
            "mv the file there and `git rm --cached` it.\n"
            "A document readers need goes in docs/, or add it to ROOT/FOLDERS in scripts/check-docs.py."
        )
        return 1
    broken = broken_links(tracked)
    if broken:
        print("Links to files that do not exist:\n")
        for b in broken:
            print(f"  · {b}")
        return 1
    print(f"Tracked documents: {len(tracked)} files, all where they ship, every link resolving.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
