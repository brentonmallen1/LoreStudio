"""
The AI feature table is the single source for feature ids (refactor doc 06 §1).

These tests are the reason it stays that way: a router that invents a feature id, a row
that no longer has a caller, or a stale generated TypeScript file all fail here rather
than showing up as a raw id in the author's activity log.
"""

import re
from pathlib import Path

import pytest

from app.services.llm.features import (
    AI_FEATURES,
    CLASS_LABELS,
    FEATURE_LABELS,
    FEATURES_BY_ID,
    GROUP_LABELS,
    feature_budget,
    feature_label,
)

APP = Path(__file__).resolve().parents[2] / "app"

#: Ids chosen at request time rather than written at a call site: the chat router takes
#: the session mode from the client and validates it against the table.
DYNAMIC_IDS = {"scene-chat", "writing-coach"}


def _feature_ids_in_source() -> dict[str, set[str]]:
    """Every `feature="..."` literal in app/, mapped id -> files that use it."""
    found: dict[str, set[str]] = {}
    for path in APP.rglob("*.py"):
        for match in re.findall(r'feature="([a-z0-9-]+)"', path.read_text()):
            found.setdefault(match, set()).add(str(path.relative_to(APP)))
    return found


def test_every_feature_id_used_in_source_is_registered():
    unknown = {fid: files for fid, files in _feature_ids_in_source().items() if fid not in FEATURES_BY_ID}
    assert not unknown, f"feature ids missing from services/llm/features.py: {unknown}"


def test_every_registered_feature_has_a_caller():
    used = set(_feature_ids_in_source()) | DYNAMIC_IDS
    orphans = sorted(set(FEATURES_BY_ID) - used)
    assert not orphans, f"rows in the feature table nothing calls: {orphans}"


def test_ids_and_labels_are_unique():
    ids = [f.id for f in AI_FEATURES]
    assert len(ids) == len(set(ids))
    labels = [f.label for f in AI_FEATURES]
    assert len(labels) == len(set(labels)), "two features share a label — Chronicle would be ambiguous"


@pytest.mark.parametrize("feature", AI_FEATURES, ids=lambda f: f.id)
def test_rows_are_complete(feature):
    assert feature.group in GROUP_LABELS
    assert feature.classification in CLASS_LABELS
    assert feature.description.endswith("."), "descriptions read as sentences"
    assert feature.context, "every feature says what it sends"
    assert 1024 <= feature.budget <= 131072


def test_feature_labels_mapping_matches_the_table():
    assert FEATURE_LABELS == {f.id: f.label for f in AI_FEATURES}


def test_lookup_helpers_fall_back_for_unknown_ids():
    assert feature_label("interview") == "Character Interview"
    assert feature_label("not-a-feature") == "Not A Feature"
    assert feature_budget("not-a-feature") > 0


def test_generated_typescript_is_current():
    """`just gen` was run after the table changed (CI runs the same check)."""
    import sys

    sys.path.insert(0, str(APP.parent / "scripts"))
    from gen_ai_features import OUT, build

    assert OUT.exists(), "features.generated.ts is missing — run `just gen`"
    assert OUT.read_text() == build(), "features.generated.ts is stale — run `just gen`"
