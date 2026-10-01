"""A finding's id: the same finding gets the same id on every read (doc 12 P3).

Built from what the finding is about, not how it is worded where the wording is the
check's own (a name, a passage), so a dismissal holds across reads. Assistant findings
change with every run; theirs is stable within a run, which is as long as they live.
"""

import hashlib
import re

from ...schemas.findings import FindingAnchor

_SPACE = re.compile(r"\s+")


def normalise(text: str) -> str:
    """Lower case, one space, straight quotes: the form two readings of a passage share."""
    text = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    return _SPACE.sub(" ", text).strip().lower()


def anchor_key(anchor: FindingAnchor) -> str:
    return "|".join(
        v or "" for v in (anchor.node_id, anchor.character_id, anchor.location_id, anchor.thread_id, anchor.twist_id)
    )


def fingerprint(check: str, anchor: FindingAnchor, text: str) -> str:
    raw = f"{check}#{anchor_key(anchor)}#{normalise(text)}"
    return hashlib.sha1(raw.encode()).hexdigest()[:16]


def content_hash(content: str | None) -> str:
    """The scene as the author last saw it, for a dismissal that lapses when it changes (D4)."""
    return hashlib.sha1((content or "").encode()).hexdigest()[:16]
