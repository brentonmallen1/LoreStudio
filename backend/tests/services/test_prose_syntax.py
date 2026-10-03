"""The inline syntax against the shared cases (shared/prose-syntax/cases.json): the editor's
tests run the same file, so the two sides read the prose alike (doc 16, D2)."""

import json
from pathlib import Path

import pytest

from app.services.prose_rewrite import find_in_text
from app.services.prose_syntax import Known, Lexicon, find_mentions, find_quotes, find_speaker_tags, reader_text

CASES = json.loads((Path(__file__).parents[3] / "shared" / "prose-syntax" / "cases.json").read_text())
LEX = Lexicon([Known(k["kind"], k["name"], tuple(k["aliases"])) for k in CASES["known"]])


@pytest.mark.parametrize("case", CASES["mentions"], ids=lambda c: c["text"][:40])
def test_mentions(case):
    got = [[case["text"][m.start : m.end], m.kind, m.name] for m in find_mentions(case["text"], LEX)]
    assert got == case["expect"]


@pytest.mark.parametrize(("text", "words"), CASES["unknown_words"])
def test_what_an_unknown_mention_says(text, words):
    assert find_mentions(text, LEX)[0].written == words


@pytest.mark.parametrize("case", CASES["speakers"], ids=lambda c: c["text"][:40])
def test_speaker_tags(case):
    text = case["text"]
    got = [[text[t.quote_start : t.quote_end], t.speaker] for t in find_speaker_tags(text)]
    assert got == case["expect"]


@pytest.mark.parametrize(("text", "expect"), CASES["reader"])
def test_reader_text(text, expect):
    assert reader_text(text) == expect


@pytest.mark.parametrize(("written", "name"), CASES["speaker_names"])
def test_who_a_speaker_tag_names(written, name):
    assert LEX.speaker(written) == name


@pytest.mark.parametrize("case", CASES["quotes"], ids=lambda c: c["text"][:40])
def test_untagged_quotes(case):
    assert [q.words for q in find_quotes(case["text"])] == case["expect"]


@pytest.mark.parametrize("case", CASES["find"], ids=lambda c: f"{c['term']} in {c['text'][:30]}")
def test_find(case):
    text = case["text"]
    spans = find_in_text(text, case["term"], case_sensitive=case["case"], whole_word=case["whole"])
    assert [text[a:b] for a, b in spans] == case["expect"]
