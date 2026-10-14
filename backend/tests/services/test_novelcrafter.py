"""Reading and mapping a Novelcrafter export (doc 28): pure functions, no pandoc."""

import io
import zipfile

import pytest

from app.schemas.import_novelcrafter import NcEntryChoice, NovelcrafterChoices
from app.schemas.import_schemas import ParsedParagraph
from app.services.novelcrafter.importing import strip_scene_prefix
from app.services.novelcrafter.mapping import left_out, propose, resolve
from app.services.novelcrafter.reader import NotAnExport, front_matter, looks_like_export, parse_chat, read_export
from app.services.novelcrafter.screenplay import as_script, blocks, looks_like_screenplay
from tests.fixtures.novelcrafter import make_export


def _zip(files: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, data in files.items():
            zf.writestr(name, data)
    return buf.getvalue()


def test_the_reader_finds_entries_snippets_and_chats():
    data = make_export()
    assert looks_like_export(data)
    e = read_export(data)
    assert len(e.entries) == 12 and len(e.snippets) == 3 and len(e.chats) == 1 and e.has_codex_html
    richard = next(x for x in e.entries if x.name == "Richard Etheridge")
    assert richard.type == "character" and richard.tags == ["Protagonist", "Hero"] and richard.nested == ["o1"]
    assert richard.thumbnail and richard.urls and richard.body == "Stoic."
    lss = next(x for x in e.entries if x.name == "The Lifesaving Service")
    assert lss.notes == "Kimball ran it."
    (chat,) = e.chats
    assert chat.date == "2024-07-30" and [r for r, _ in chat.turns] == ["user", "assistant", "user", "assistant"]


def test_front_matter_reads_lists_mappings_and_quotes():
    meta, body = front_matter('---\ntitle: ""\ntags:\n  - A\n  - B\nfields:\n  Age: 40\nfavourite: true\n---\nWords')
    assert meta == {"title": "", "tags": ["A", "B"], "fields": {"Age": "40"}, "favourite": True}
    assert body == "Words"
    assert parse_chat("## User\nHi\n## AI\nHello") == ("", [("user", "Hi"), ("assistant", "Hello")])


@pytest.mark.parametrize(
    "files, why",
    [
        ({"../evil.txt": b"x", "novel.docx": b"d"}, "outside"),
        ({"a/b/metadata.json": b"{}"}, "no novel.docx"),
    ],
)
def test_an_unsafe_or_incomplete_archive_is_refused(files, why):
    with pytest.raises(NotAnExport, match=why):
        read_export(_zip(files))
    assert not looks_like_export(b"not a zip")


def test_oversized_files_are_refused(monkeypatch):
    from app.services.novelcrafter import reader

    monkeypatch.setattr(reader, "MAX_TOTAL_BYTES", 10)
    with pytest.raises(NotAnExport, match="too large"):
        read_export(make_export())


def test_the_defaults_fold_facets_map_tags_and_flag_clashes():
    p = propose(read_export(make_export()))
    by = {r.name: r for r in p.entries}
    assert by["Richard Etheridge"].target == "character"
    # Nested, and by name through another name ("Newcomb")
    assert (by["Richard (Physical)"].target, by["Richard (Physical)"].facet_field) == ("facet", "appearance")
    assert by["Richard (Physical)"].facet_of == "c1"
    assert (by["Newcomb (Emotion)"].facet_of, by["Newcomb (Emotion)"].facet_field) == ("c2", "thinking")
    assert by["Richard (Monologue)"].facet_field == "note"
    assert by["Noble Bigot with a Badge"].target == "trope"
    assert by["White Supremacy is flawed"].target == "theme"
    assert by["The fire at Station 17"].target == "thread"
    assert by["The Lifesaving Service"].target == "later"
    assert by["Station 17: Pea Island"].clash_with == "l1"
    assert by["Pea Island"].clash_with == "l1"
    assert {s.title: s.target for s in p.snippets} == {"Logline": "logline", "The Wreck": "compendium", "": "note"}


def test_what_has_no_place_lists_only_what_was_set():
    export = read_export(make_export())
    entries, _ = resolve(propose(export), NovelcrafterChoices())
    no_place, nothing = left_out(export, entries)
    tags = next(x for x in no_place if x.what.startswith("Tags"))
    # Protagonist and Hero become the role and archetype; Trope and Theme chose the home.
    assert tags.what == "Tags OBX" and tags.examples == ["Pea Island"]
    assert "Colors" in nothing and "Favorite snippets" in nothing and "Custom fields" in nothing
    # A leftover keeps its tags: "Lifesaving Service" is not lost.
    assert "Lifesaving" not in tags.what

    favoured = read_export(make_export(favourite=True))
    no_place, nothing = left_out(favoured, resolve(propose(favoured), NovelcrafterChoices())[0])
    assert any(x.what == "Favorite snippets" for x in no_place) and "Favorite snippets" not in nothing


def test_the_authors_choices_win_over_the_defaults():
    p = propose(read_export(make_export()))
    choices = NovelcrafterChoices(entries={"r2": NcEntryChoice(target="world_system")}, snippets={"2jc8r8zA": "skip"})
    entries, snippets = resolve(p, choices)
    assert entries["r2"].target == "world_system" and entries["c1"].target == "character"
    assert snippets["2jc8r8zA"] == "skip" and snippets["2jtcAxi8"] == "logline"


def test_scene_titles_lose_novelcrafters_numbering():
    assert strip_scene_prefix("Chapter 1: Scene 1: Lay of the Land") == "Lay of the Land"
    assert strip_scene_prefix("Act 1: The Crime and Initial Investigation") == "The Crime and Initial Investigation"
    assert strip_scene_prefix("Chapter 3") == "Chapter 3"
    assert strip_scene_prefix("Opening Image") == "Opening Image"


def test_flattened_script_lines_become_elements():
    assert blocks("NEWCOMB (looking up) We are hitting a wall.") == [
        ("cue", "NEWCOMB"),
        ("paren", "(looking up)"),
        ("dialogue", "We are hitting a wall."),
    ]
    assert blocks("RICHARD So, they get away\nwith it?") == [
        ("cue", "RICHARD"),
        ("dialogue", "So, they get away with it?"),
    ]
    assert blocks("INT. OFFICE - DAY") == [("heading", "INT. OFFICE - DAY")]
    assert blocks("Fade In:") == [("transition", "FADE IN:")]
    assert blocks("Richard's fists clench.") == [("action", "Richard's fists clench.")]
    assert blocks("A man walks in.") == [("action", "A man walks in.")]

    def para(i, text, tag="p"):
        return ParsedParagraph(index=i, html=f"<{tag}>{text}</{tag}>", text_preview=text, tag=tag, word_count=1)

    paras = [para(0, "Act", "h1"), para(1, "INT. OFFICE - DAY"), para(2, "RICHARD So?"), para(3, "CUT TO:")]
    assert looks_like_screenplay(paras)
    typed, elements = as_script(paras)
    assert elements == ["section", "heading", "cue", "transition"]
    assert typed[2].html == '<p data-el="cue">RICHARD</p><p data-el="dialogue">So?</p>'
    assert not looks_like_screenplay([para(0, "Once upon a time."), para(1, "The end.")])
