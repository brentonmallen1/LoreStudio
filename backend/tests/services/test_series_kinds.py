"""The series kinds are real columns, every field has a class, and overrides win."""

from sqlalchemy import inspect as sa_inspect

from app.services.change_log import ENTITY_MODELS
from app.services.series.kinds import (
    FRONTEND_KIND,
    PROMISE_KINDS,
    SERIES_KINDS,
    enduring_fields,
    evolving_fields,
    field_class,
    kind_for_table,
    name_of,
)


def _columns(model) -> set[str]:
    return {a.key for a in sa_inspect(model).mapper.column_attrs}


def test_every_field_is_a_column_of_its_model():
    for kind in SERIES_KINDS.values():
        missing = set(kind.fields) - _columns(kind.model)
        assert not missing, f"{kind.kind}: {missing}"
        assert kind.model.__tablename__ == kind.table
        assert kind.name_attr in _columns(kind.model), "Canon and ghost rows show the name"


def test_a_field_is_enduring_or_evolving_never_both():
    for kind in SERIES_KINDS.values():
        assert not set(kind.enduring) & set(kind.evolving), kind.kind
        assert len(kind.fields) == len(set(kind.fields)), kind.kind


def test_refs_and_fresh_columns_are_real():
    for kind in SERIES_KINDS.values():
        for column, ref_kind in kind.refs:
            assert column in _columns(kind.model)
            assert ref_kind in SERIES_KINDS
        assert set(kind.fresh) <= _columns(kind.model), kind.kind


def test_every_kind_is_undoable_by_its_own_name():
    for kind in SERIES_KINDS.values():
        assert ENTITY_MODELS.get(kind.kind) is kind.model


def test_kind_for_table_and_frontend_names():
    assert kind_for_table("characters").kind == "character"
    assert kind_for_table("plot_threads").kind == "plot_thread"
    assert kind_for_table("scene_links") is None
    assert set(FRONTEND_KIND) <= set(SERIES_KINDS)
    assert FRONTEND_KIND == {"world_system": "system", "historical_event": "event", "plot_thread": "thread"}


def test_promises_come_last_and_are_not_named_in_prose():
    order = list(SERIES_KINDS)
    assert order[-len(PROMISE_KINDS) :] == list(PROMISE_KINDS), "a sequel carries its cast before its questions"
    for kind in PROMISE_KINDS:
        assert not SERIES_KINDS[kind].prose_named
    assert SERIES_KINDS["character"].prose_named
    # The colour is copied, never compared: a different colour is not a disagreement.
    assert "color_slot" not in SERIES_KINDS["plot_thread"].fields
    assert "revealed_at_node_id" in SERIES_KINDS["twist"].fresh


def test_every_kind_anchors_its_sheet_findings_on_a_real_anchor():
    from app.schemas.findings import FindingAnchor

    for kind in SERIES_KINDS.values():
        if kind.anchor_col is not None:
            assert kind.anchor_col in FindingAnchor.model_fields, kind.kind


def test_name_of_reads_the_kind_s_own_column():
    class Row:
        name = "Eleanor"
        title = "Lighthouse logs"

    assert name_of(Row()) == "Eleanor"
    assert name_of(Row(), SERIES_KINDS["character"]) == "Eleanor"


def test_overrides_win_over_defaults():
    character = SERIES_KINDS["character"]
    assert field_class(character, "background", None) == "enduring"
    assert field_class(character, "personality", None) == "evolving"
    overrides = {"character": {"appearance": "evolving", "personality": "enduring", "flaws": "nonsense"}}
    assert field_class(character, "appearance", overrides) == "evolving"
    assert field_class(character, "personality", overrides) == "enduring"
    assert field_class(character, "flaws", overrides) == "evolving"
    assert "appearance" not in enduring_fields(character, overrides)
    assert "personality" in enduring_fields(character, overrides)
    assert set(enduring_fields(character, overrides)) | set(evolving_fields(character, overrides)) == set(
        character.fields
    )
