"""
Where the story gets cut into passages (doc 07 §4).

The seams are the whole point. A retrieved passage is quoted back into a prompt, so a
chunk that ends mid-sentence puts half a thought in front of the model and calls it
context. These tests hold the cutter to whole paragraphs wherever a paragraph fits.
"""

from app.services.codex.chunker import (
    TARGET_TOKENS,
    chunk_entry,
    chunk_prose,
    estimate_tokens,
    pack_paragraphs,
)


def _para(words: int, word: str = "lamp") -> str:
    return " ".join([word] * words)


def test_short_paragraphs_are_packed_together():
    passages = pack_paragraphs(["One.", "Two.", "Three."])
    assert passages == ["One.\n\nTwo.\n\nThree."]


def test_a_paragraph_is_never_cut_to_hit_the_target():
    first, second = _para(300), _para(300, "storm")
    passages = pack_paragraphs([first, second])
    assert passages == [first, second]


def test_an_oversized_paragraph_is_split_on_sentences():
    monster = " ".join(f"{_para(120)} number {i}." for i in range(6))
    passages = pack_paragraphs([monster])
    assert len(passages) > 1
    assert all(p.rstrip().endswith(".") for p in passages)
    # Nothing is lost in the splitting.
    assert "".join(passages).count("number") == 6


def test_prose_chunks_are_ordered_and_counted():
    html = f"<p>{_para(200)}</p><p>{_para(200, 'storm')}</p>"
    chunks = chunk_prose(html)
    assert [c.index for c in chunks] == list(range(len(chunks)))
    assert all(c.token_count == estimate_tokens(c.text) for c in chunks)
    assert "<p>" not in chunks[0].text


def test_a_fragment_is_not_worth_indexing():
    assert chunk_prose("<p>Yes.</p>") == []


def test_a_lorebook_entry_stays_whole_when_it_fits():
    chunks = chunk_entry("Elena Vasquez — protagonist", "Stubborn.", "", None, "Afraid of the water.")
    assert len(chunks) == 1
    assert chunks[0].text.startswith("Elena Vasquez")
    assert "Afraid of the water." in chunks[0].text


def test_a_long_entry_is_split_but_a_single_field_never_is():
    long_field = _para(TARGET_TOKENS)
    assert len(chunk_entry("Elena", long_field)) == 1
    assert len(chunk_entry("Elena", long_field, _para(TARGET_TOKENS, "storm"))) == 2


def test_a_heading_with_nothing_under_it_is_not_a_passage():
    """An empty stub would match its own name perfectly and outrank real prose."""
    assert chunk_entry("Pier") == []
    assert chunk_entry("Pier", None, "   ") == []


def test_the_same_text_hashes_the_same():
    """The hash is what lets a reindex keep a vector it already paid for."""
    a = chunk_prose(f"<p>{_para(80)}</p>")[0]
    b = chunk_prose(f"<p>{_para(80)}</p>")[0]
    assert a.text_hash == b.text_hash
    assert a.text_hash != chunk_prose(f"<p>{_para(81)}</p>")[0].text_hash
