"""Building a finding: one place that gives it its id and maps outside words onto ours."""

from __future__ import annotations

from typing import Any

from ...schemas.findings import Finding, FindingAnchor, FindingKind, Severity, Source
from .fingerprint import fingerprint

#: Every severity word a check or a model uses, onto three.
_SEVERITY: dict[str, Severity] = {
    "critical": "high",
    "high": "high",
    "strong": "high",
    "issue": "high",
    "moderate": "mid",
    "medium": "mid",
    "warning": "mid",
    "warn": "mid",
    "minor": "low",
    "low": "low",
    "subtle": "low",
    "info": "low",
}


def severity(word: str | None, default: Severity = "mid") -> Severity:
    return _SEVERITY.get((word or "").strip().lower(), default)


def make(
    check: str,
    kind: FindingKind,
    sev: Severity,
    source: Source,
    text: str,
    *,
    anchor: FindingAnchor | None = None,
    key: str | None = None,
    **fields: Any,
) -> Finding:
    """``key`` is what the fingerprint hashes when the text varies but the finding does
    not (a count that changes as the author writes)."""
    anchor = anchor or FindingAnchor()
    return Finding(
        id=fingerprint(check, anchor, key if key is not None else text),
        check=check,
        kind=kind,
        severity=sev,
        source=source,
        text=text,
        anchor=anchor,
        **fields,
    )
