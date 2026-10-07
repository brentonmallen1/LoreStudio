#!/usr/bin/env python3
"""Refuse to ship personal data (doc 23 P8). Runs in `just ci`, CI's gates and the pre-commit hook.

Before 2026-09-26 the repository tracked its own runtime data: the development database (with
every story, conversation and AI prompt in it), story snapshots and uploaded images, and they are
still in its history. Two checks keep anything like that out of the tree from here:

1. **Runtime data is never tracked.** A database, its WAL, a story export, or anything under a
   data, uploads, snapshots or backups folder fails here, whatever .gitignore says (a file added
   with `git add -f`, or before the ignore rule existed, is tracked all the same).

2. **Terms that must never appear**: names, addresses, anything real that a story or a fixture
   could carry in. The list is hashed (as IGAB's is): a plaintext list of the strings you must not
   publish is itself such a string. Words match on word and word-pair boundaries. Add one with
   `python3 scripts/check-pii.py --add "Some Name"`, which prints the digests to paste below.
   The list starts empty; it is a ratchet, grown whenever something real is found.
"""

from __future__ import annotations

import hashlib
import re
import subprocess
import sys
from fnmatch import fnmatch

#: Single words, hashed (`--add` prints them).
UNIGRAMS: set[str] = set()
#: Adjacent word pairs, for names whose halves are each too common to deny.
BIGRAMS: set[str] = set()

#: Runtime data: never tracked.
DATA = (
    "*.db",
    "*.db-wal",
    "*.db-shm",
    "*.sqlite",
    "*.sqlite3",
    "*.lorestudio.zip",
    "data/*",
    "*/data/*",
    "*/uploads/*",
    "*/snapshots/*",
    "*/backups/*",
)
#: Text worth reading for terms; images and lockfiles are not.
TEXT = re.compile(r"\.(py|ts|tsx|js|json|md|css|html|yml|yaml|toml|xml|txt|sh|ini|mako|example)$|^justfile$|Dockerfile")
WORD = re.compile(r"[a-z0-9][a-z0-9'’-]*")


def digest(term: str) -> str:
    return hashlib.sha256(term.lower().encode()).hexdigest()[:16]


def tracked() -> list[str]:
    return subprocess.run(["git", "ls-files"], capture_output=True, text=True, check=True).stdout.splitlines()


def data_files(paths: list[str]) -> list[str]:
    return [p for p in paths if any(fnmatch(p, pat) for pat in DATA)]


def term_hits(paths: list[str]) -> list[str]:
    if not UNIGRAMS and not BIGRAMS:
        return []
    out = []
    for p in paths:
        if not TEXT.search(p.rsplit("/", 1)[-1]):
            continue
        try:
            text = open(p, encoding="utf-8").read().lower()
        except (OSError, UnicodeDecodeError):
            continue
        for n, line in enumerate(text.splitlines(), 1):
            words = WORD.findall(line)
            pairs = [f"{a} {b}" for a, b in zip(words, words[1:], strict=False)]
            if any(digest(w) in UNIGRAMS for w in words) or any(digest(b) in BIGRAMS for b in pairs):
                out.append(f"{p}:{n}")
    return out


def main(argv: list[str]) -> int:
    if argv[:1] == ["--add"]:
        for term in argv[1:]:
            words = WORD.findall(term.lower())
            kind = "BIGRAMS" if len(words) == 2 else "UNIGRAMS"
            print(f'{kind}: "{digest(" ".join(words))}"')
        return 0
    paths = tracked()
    problems = [f"runtime data is tracked: {p} (git rm --cached it)" for p in data_files(paths)]
    problems += [f"a denied term: {hit}" for hit in term_hits(paths)]
    if problems:
        print("Personal data in the tree:\n")
        for p in problems:
            print(f"  · {p}")
        return 1
    print(f"Personal data: {len(paths)} tracked files, no runtime data, {len(UNIGRAMS) + len(BIGRAMS)} terms denied.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
