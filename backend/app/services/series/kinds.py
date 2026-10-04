"""What a series can carry from book to book, and which of each kind's fields stay true.

Every field is one of two classes:

* **enduring**: one truth for the whole series (where a character comes from, a place's
  history, the rules of a magic system). Books that disagree raise a finding.
* **evolving**: each book has its own value (what a character wants now, how a place
  feels now). Differences are the progression, never a finding.

These are defaults; a series overrides any field per kind (``Series.field_classes``).
Field keys are the model columns and the same keys as frontend/src/lib/lorebook/kinds.ts,
so the sheets' labels apply. The frontend calls some kinds by other names: see
``FRONTEND_KIND``.

Threads and twists are series kinds too (v1.5): a thread that runs across books is one
element with a row in each, and each book's scenes say what it does there. What a thread
does across the series is read from those scenes (services/series/promises.py), never
copied, because scenes belong to one book.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Literal

from ...models.calendar import Calendar
from ...models.character import Character
from ...models.compendium import CompendiumEntry
from ...models.culture import Culture
from ...models.diagram import Diagram
from ...models.historical_event import Era, HistoricalEvent
from ...models.location import Location
from ...models.media import StoryAsset
from ...models.plot_thread import PlotThread
from ...models.twist import Twist
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
    #: The column that names a row (a research entry has a title, not a name).
    name_attr: str = "name"
    #: Prose names it ("Eleanor", "Harrow Island"), so naming it in a book that lacks it is
    #: worth a proposal. A thread's name ("The Missing Logs") is the author's, not the prose's.
    prose_named: bool = True
    #: The finding anchor a sheet of this kind shows its findings by.
    anchor_col: str | None = None
    #: Kept in step: every book has it and an edit in one is every book's (shared research).
    #: Never compared, never a finding, never offered to carry: it is simply everywhere.
    synced: bool = False
    #: After a copy is made, given (db, source row, copy): what a column copy cannot do,
    #: such as giving an image its own file.
    after_copy: Callable[[Any, Any, Any], None] | None = None

    @property
    def fields(self) -> tuple[str, ...]:
        return self.enduring + self.evolving


def _own_file(db: Any, src: Any, copy: Any) -> None:
    """An image or document shared with another book gets its own file there."""
    from ..media_files import give_own_file

    give_own_file(src, copy)


def name_of(row: Any, kind: SeriesKind | None = None) -> str:
    """What a row is called, whatever its kind calls the column."""
    attr = kind.name_attr if kind else "name"
    return str(getattr(row, attr, None) or getattr(row, "name", None) or "")


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
            anchor_col="character_id",
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
            anchor_col="location_id",
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
        # Shared research (v1.5): kept in step, in every book, never compared or carried.
        # Files before the entries that hold them, so an entry's copy finds its own file.
        SeriesKind(
            kind="story_asset",
            model=StoryAsset,
            table="story_assets",
            label="Image",
            plural="Images",
            enduring=("original_filename", "alt_text", "description"),
            evolving=(),
            name_attr="original_filename",
            prose_named=False,
            synced=True,
            after_copy=_own_file,
        ),
        SeriesKind(
            kind="diagram",
            model=Diagram,
            table="diagrams",
            label="Diagram",
            plural="Diagrams",
            enduring=("title", "description", "diagram_type", "nodes", "edges"),
            evolving=(),
            # Pinned to a scene of the book it was drawn in.
            fresh={"attached_node_id": None},
            name_attr="title",
            prose_named=False,
            synced=True,
        ),
        SeriesKind(
            kind="compendium_entry",
            model=CompendiumEntry,
            table="compendium_entries",
            label="Research",
            plural="Research",
            enduring=(
                "title",
                "entry_type",
                "content",
                "url",
                "url_title",
                "url_description",
                "tags",
                "category",
                "notes",
            ),
            evolving=(),
            refs=(("asset_id", "story_asset"),),
            name_attr="title",
            prose_named=False,
            synced=True,
        ),
        # Promises last: a sequel carries its cast and world before the questions they hold.
        SeriesKind(
            kind="plot_thread",
            model=PlotThread,
            table="plot_threads",
            label="Thread",
            plural="Threads",
            # The colour is copied so a thread looks the same in every book, but never compared.
            enduring=("name", "mice_type"),
            evolving=("description",),
            # Set aside is this book's word on it; the next book picks it up afresh.
            fresh={"set_aside": False},
            prose_named=False,
            anchor_col="thread_id",
        ),
        SeriesKind(
            kind="twist",
            model=Twist,
            table="twists",
            label="Twist",
            plural="Twists",
            enduring=("name", "the_truth", "twist_type"),
            # The cover story can shift from book to book; the truth is the anchor.
            evolving=("the_misdirection",),
            # A reveal is a scene of the book it happens in.
            fresh={"revealed_at_node_id": None},
            prose_named=False,
            anchor_col="twist_id",
        ),
    )
}

#: The kinds whose threads of story run across books (services/series/promises.py).
PROMISE_KINDS = ("plot_thread", "twist")

#: Shared research, kept in step in every book (services/series/sync.py).
SYNCED_KINDS = tuple(k for k, spec in SERIES_KINDS.items() if spec.synced)

#: Server kind -> the frontend's LoreKind, where they differ.
FRONTEND_KIND: dict[str, str] = {
    "world_system": "system",
    "historical_event": "event",
    "plot_thread": "thread",
}

#: A field's name in a sentence, where the column's own reads wrong ("the source", not
#: "the source origin"). Everything else is the column with spaces.
FIELD_WORDS: dict[str, str] = {
    "location_type": "kind of place",
    "system_type": "kind of system",
    "source_origin": "source",
    "start_date": "start",
    "end_date": "end",
    "in_world_date": "date",
    "epoch_name": "epoch",
    "mission_statement": "want",
    "conflict": "obstacle",
    "legacy_effects": "legacy",
    "arc_in_own_words": "arc in their own words",
}


def field_words(key: str) -> str:
    return FIELD_WORDS.get(key, key.replace("_", " "))


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
