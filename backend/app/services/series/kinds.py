"""What a series can carry from book to book, and which of each kind's fields stay true.

Every field is one of two classes:

* **enduring**: one truth for the whole series (where a character comes from, a place's
  history, the rules of a magic system). Books that disagree raise a finding.
* **evolving**: each book has its own value (what a character wants now, how a place
  feels now). Differences are the progression, never a finding.

These are defaults; a series overrides any field per kind (``Series.field_classes``).
Field keys are the model columns and the same keys as frontend/src/lib/lorebook/kinds.ts,
so the sheets' labels apply. The frontend calls two kinds by other names: see
``FRONTEND_KIND``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from ...models.calendar import Calendar
from ...models.character import Character
from ...models.culture import Culture
from ...models.historical_event import Era, HistoricalEvent
from ...models.location import Location
from ...models.world_system import WorldSystem

FieldClass = Literal["enduring", "evolving"]


@dataclass(frozen=True)
class SeriesKind:
    kind: str
    #: The ORM model (Any: rows of it are read and written by column name).
    model: Any
    table: str
    label: str
    plural: str
    enduring: tuple[str, ...]
    evolving: tuple[str, ...]
    #: Columns that point at another row of a series kind, as (column, that kind):
    #: a copy re-points them at the same element in the new book, or empties them.
    refs: tuple[tuple[str, str], ...] = ()
    #: Columns a copy starts afresh, with the value given: they belong to one book only.
    fresh: dict[str, object] = field(default_factory=dict)

    @property
    def fields(self) -> tuple[str, ...]:
        return self.enduring + self.evolving


SERIES_KINDS: dict[str, SeriesKind] = {
    k.kind: k
    for k in (
        SeriesKind(
            kind="character",
            model=Character,
            table="characters",
            label="Character",
            plural="Characters",
            enduring=("background", "appearance"),
            evolving=(
                "mission_statement",
                "conflict",
                "personality",
                "motivation",
                "epiphany",
                "flaws",
                "quirks",
                "speech_patterns",
                "arc_notes",
                "narrative_intent",
                "arc_in_own_words",
            ),
            # Milestones and discovery notes name scenes of the book they were made in.
            fresh={"arc_milestones": [], "discovery_notes": []},
        ),
        SeriesKind(
            kind="location",
            model=Location,
            table="locations",
            label="Place",
            plural="Places",
            enduring=(
                "location_type",
                "history",
                "climate",
                "terrain",
                "orbital_period",
                "distance_from_parent",
                "gravity",
                "habitability",
                "radiation_level",
            ),
            evolving=("description", "atmosphere", "significance", "political_affiliation"),
            refs=(("parent_id", "location"),),
            fresh={"is_stub": False, "discovered_from_id": None, "discovered_at": None},
        ),
        SeriesKind(
            kind="world_system",
            model=WorldSystem,
            table="world_systems",
            label="System",
            plural="Systems",
            enduring=("system_type", "source_origin", "rules", "limitations", "costs"),
            evolving=("notes",),
        ),
        SeriesKind(
            kind="culture",
            model=Culture,
            table="cultures",
            label="Culture",
            plural="Cultures",
            enduring=("values", "customs", "taboos", "religion"),
            evolving=("description", "social_hierarchy", "government_type", "economy", "notes"),
        ),
        SeriesKind(
            kind="era",
            model=Era,
            table="eras",
            label="Era",
            plural="Eras",
            enduring=("start_date", "end_date", "description", "characteristics"),
            evolving=(),
        ),
        SeriesKind(
            kind="historical_event",
            model=HistoricalEvent,
            table="historical_events",
            label="Event",
            plural="Events",
            enduring=("in_world_date", "description", "causes", "consequences"),
            # How the past is remembered is the story's present, and that moves on.
            evolving=("legacy_effects",),
            refs=(("era_id", "era"),),
        ),
        SeriesKind(
            kind="calendar",
            model=Calendar,
            table="calendars",
            label="Calendar",
            plural="Calendars",
            enduring=("epoch_name", "description", "conversion_notes"),
            evolving=(),
        ),
    )
}

#: Server kind -> the frontend's LoreKind, where they differ.
FRONTEND_KIND: dict[str, str] = {"world_system": "system", "historical_event": "event"}

#: Never copied: the row's own identity and bookkeeping.
NOT_COPIED = frozenset({"id", "story_id", "created_at", "updated_at"})


def kind_for_table(table: str) -> SeriesKind | None:
    return next((k for k in SERIES_KINDS.values() if k.table == table), None)


def field_class(kind: SeriesKind, field_key: str, overrides: dict | None) -> FieldClass:
    """The class of one field in one series: the series' override, or the default."""
    override = ((overrides or {}).get(kind.kind) or {}).get(field_key)
    if override in ("enduring", "evolving"):
        return override
    return "enduring" if field_key in kind.enduring else "evolving"


def enduring_fields(kind: SeriesKind, overrides: dict | None) -> list[str]:
    return [f for f in kind.fields if field_class(kind, f, overrides) == "enduring"]


def evolving_fields(kind: SeriesKind, overrides: dict | None) -> list[str]:
    return [f for f in kind.fields if field_class(kind, f, overrides) == "evolving"]
