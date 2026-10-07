#!/usr/bin/env python3
"""Tracked documents: what ships is what a reader of the repo should read (doc 23 D5).

Reviews, prompts, planning notes and scratch writing belong in `notes/`, which git ignores.
They used to land at the root (CHAT_REVIEW.md, original_notes.md) and stay there, so every
markdown file git tracks must be one of the documents below or live in a folder meant for them.
A new one fails here with where to put it; one that should ship is added to the list.
"""

import subprocess
import sys

#: Documents at the repo root a reader is meant to find.
ROOT = {"README.md", "CLAUDE.md", "DESIGN.md", "CONTRIBUTING.md"}
#: Folders whose markdown ships: the docs, the in-app guides, the Unraid notes, GitHub's files.
FOLDERS = ("docs/", "frontend/src/guides/", "unraid/", ".github/")


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
    print(f"Tracked documents: {len(tracked)} files, all where they ship.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
