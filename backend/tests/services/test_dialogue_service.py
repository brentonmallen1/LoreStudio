"""Tests for dialogue extraction logic.

Note on HTML encoding: TipTap stores text characters < and > as HTML entities
&lt; and &gt;. So the dialogue syntax "Hello"<Name> is stored as "Hello"&lt;Name&gt;
in the database. The HTML parser (with convert_charrefs=True) converts these
back to < and > in handle_data, so extraction sees "Hello"<Name>.
Tests use entity-encoded form to match the real production code path.
"""

from app.services.dialogue_service import _html_to_paragraphs, extract_dialogue

# ---------------------------------------------------------------------------
# HTML → paragraph extraction
# ---------------------------------------------------------------------------


def test_html_to_paragraphs_basic():
    html = "<p>First paragraph.</p><p>Second paragraph.</p>"
    paras = _html_to_paragraphs(html)
    assert len(paras) == 2
    assert paras[0] == "First paragraph."
    assert paras[1] == "Second paragraph."


def test_html_to_paragraphs_empty():
    assert _html_to_paragraphs("") == []
    assert _html_to_paragraphs("<p></p>") == []


# ---------------------------------------------------------------------------
# Explicit attribution: "..."<Name>  (stored as "..."&lt;Name&gt; in HTML)
# ---------------------------------------------------------------------------


def test_explicit_straight_quotes():
    html = '<p>"I don\'t think this will work."&lt;Maya&gt;</p>'
    blocks = extract_dialogue(html)
    assert len(blocks) == 1
    b = blocks[0]
    assert b["speaker_name"] == "Maya"
    assert b["content"] == "I don't think this will work."
    assert b["attribution_method"] == "explicit"
    assert b["confidence"] == 1.0


def test_explicit_multiple_speakers():
    html = (
        '<p>"I don\'t believe you."&lt;Maya&gt;</p>'
        '<p>"Why not?"&lt;Thomas&gt;</p>'
        '<p>"Because you\'re lying."&lt;Maya&gt;</p>'
    )
    blocks = extract_dialogue(html)
    assert len(blocks) == 3
    assert blocks[0]["speaker_name"] == "Maya"
    assert blocks[1]["speaker_name"] == "Thomas"
    assert blocks[2]["speaker_name"] == "Maya"
    assert all(b["attribution_method"] == "explicit" for b in blocks)


def test_explicit_with_multiword_name():
    html = '<p>"You shall not pass."&lt;Lady Ashford&gt;</p>'
    blocks = extract_dialogue(html)
    assert len(blocks) == 1
    assert blocks[0]["speaker_name"] == "Lady Ashford"
    assert blocks[0]["attribution_method"] == "explicit"


def test_explicit_mid_sentence():
    """Speaker tag works when quote appears mid-sentence with surrounding prose."""
    html = '<p>@Maya said to @Thomas, "Hello."&lt;Maya&gt; He looked away.</p>'
    blocks = extract_dialogue(html)
    explicit = [b for b in blocks if b["attribution_method"] == "explicit"]
    assert len(explicit) == 1
    assert explicit[0]["speaker_name"] == "Maya"
    assert explicit[0]["content"] == "Hello."


# ---------------------------------------------------------------------------
# Inferred attribution: "dialogue" ... @Name
# ---------------------------------------------------------------------------


def test_inferred_trailing_mention():
    html = '<p>"I don\'t think this will work," @Maya said, frowning.</p>'
    blocks = extract_dialogue(html)
    assert len(blocks) >= 1
    maya_blocks = [b for b in blocks if b["speaker_name"] == "Maya"]
    assert len(maya_blocks) >= 1
    assert maya_blocks[0]["attribution_method"] == "inferred"


def test_inferred_leading_mention():
    html = '<p>@Thomas turned and said "We have no choice."</p>'
    blocks = extract_dialogue(html)
    assert len(blocks) >= 1
    thomas_blocks = [b for b in blocks if b["speaker_name"] == "Thomas"]
    assert len(thomas_blocks) >= 1


def test_explicit_not_also_inferred():
    """A "..."<Name> quote should NOT be picked up by the inference pass."""
    html = '<p>"I don\'t believe you."&lt;Maya&gt; @Thomas stood watching.</p>'
    blocks = extract_dialogue(html)
    # Should have exactly 1 block (explicit), not 2 (explicit + inferred)
    assert len(blocks) == 1
    assert blocks[0]["attribution_method"] == "explicit"
    assert blocks[0]["speaker_name"] == "Maya"


# ---------------------------------------------------------------------------
# Unattributed
# ---------------------------------------------------------------------------


def test_unattributed_no_mention():
    html = '<p>"Hello," she said quietly.</p>'
    blocks = extract_dialogue(html)
    assert len(blocks) >= 1
    unattr = [b for b in blocks if b["attribution_method"] == "unattributed"]
    assert len(unattr) >= 1


def test_no_dialogue():
    html = "<p>The lighthouse stood alone on the cliff, battered by wind.</p>"
    blocks = extract_dialogue(html)
    assert blocks == []


# ---------------------------------------------------------------------------
# Alternation
# ---------------------------------------------------------------------------


def test_alternation_between_two_speakers():
    html = (
        '<p>@Maya turned to @Thomas.</p><p>"I don\'t believe you."</p><p>"Why not?"</p><p>"Because you\'re lying."</p>'
    )
    blocks = extract_dialogue(html)
    # First quote should be attributed to Maya (nearest mention in para 0)
    # Subsequent quotes should alternate
    assert len(blocks) >= 2


# ---------------------------------------------------------------------------
# Export: _clean_mentions strips &lt;Name&gt; suffix
# ---------------------------------------------------------------------------


def test_explicit_dialogue_stripped_for_export():
    from app.services.manuscript_builder import _clean_mentions

    html = '<p>"I don\'t think this will work."&lt;Maya&gt;</p>'
    cleaned = _clean_mentions(html)
    assert "&lt;Maya&gt;" not in cleaned
    assert "I don't think this will work." in cleaned


def test_export_preserves_surrounding_prose():
    from app.services.manuscript_builder import _clean_mentions

    html = '<p>She said "Hello."&lt;Maya&gt; He looked away.</p>'
    cleaned = _clean_mentions(html)
    assert "&lt;Maya&gt;" not in cleaned
    assert '"Hello."' in cleaned
    assert "He looked away." in cleaned


def test_regular_mention_still_stripped():
    from app.services.manuscript_builder import _clean_mentions

    html = "<p>@Maya walked into the room.</p>"
    cleaned = _clean_mentions(html)
    assert "@Maya" not in cleaned
    assert "Maya walked into the room." in cleaned


def test_setting_mention_stripped():
    from app.services.manuscript_builder import _clean_mentions

    html = "<p>She arrived at [[The Old Lighthouse]].</p>"
    cleaned = _clean_mentions(html)
    assert "[[" not in cleaned
    assert "The Old Lighthouse" in cleaned


def test_export_does_not_strip_html_tags():
    from app.services.manuscript_builder import _clean_mentions

    # Entity-encoded speaker tag should be stripped; HTML tags preserved
    html = '<p>She said "Hello."&lt;Maya&gt; He <strong>nodded</strong>.</p>'
    cleaned = _clean_mentions(html)
    assert "<strong>" in cleaned
    assert "&lt;Maya&gt;" not in cleaned


# ── Speech tags with a plain name ────────────────────────────────────────────


def test_a_plain_name_tag_attributes_the_line():
    """ "Eleanor said" named nobody before: only @mentions were read, so real prose was Unknown."""
    from app.services.dialogue_service import extract_dialogue

    html = (
        '<p>"You\'re early," Eleanor said.</p>'
        '<p>"The tide," said Calder, "does not wait."</p>'
        '<p>Margaret asked, "Tea?"</p>'
        '<p>"Nobody knows who says this."</p>'
    )
    blocks = extract_dialogue(html, names=["Eleanor", "Calder", "Margaret"])
    speakers = [(b["content"], b["speaker_name"], b["attribution_method"]) for b in blocks]
    assert speakers[0] == ("You're early,", "Eleanor", "inferred")
    assert speakers[1][1] == "Calder"
    assert ("Tea?", "Margaret", "inferred") in speakers
    # No tag and no mention: whatever alternation makes of it, the tag pass claimed nothing.
    assert speakers[-1][2] != "inferred"


def test_the_character_acting_in_a_paragraph_speaks_it():
    from app.services.dialogue_service import extract_dialogue

    [block] = extract_dialogue('<p>"Close the door." Eleanor looked at the sea.</p>', names=["Eleanor"])
    assert (block["speaker_name"], block["attribution_method"]) == ("Eleanor", "inferred")


def test_a_name_the_narration_only_looks_at_attributes_nothing():
    from app.services.dialogue_service import extract_dialogue

    [block] = extract_dialogue('<p>"Close the door." She looked at Eleanor.</p>', names=["Eleanor"])
    assert (block["speaker_name"], block["attribution_method"]) == ("", "unattributed")


def test_two_characters_acting_leave_the_line_open():
    from app.services.dialogue_service import extract_dialogue

    [block] = extract_dialogue('<p>"Close the door." Eleanor sat. Calder stood.</p>', names=["Eleanor", "Calder"])
    assert block["attribution_method"] == "unattributed"


def test_a_split_line_is_one_speakers():
    from app.services.dialogue_service import extract_dialogue

    blocks = extract_dialogue(
        '<p>"I could burn them," Eleanor said. "The whole set."</p>'
        '<p>"You could."&lt;Calder&gt;</p>'
        '<p>"What I want," she said, "is quiet."</p>',
        names=["Eleanor", "Calder"],
    )
    assert [b["speaker_name"] for b in blocks] == ["Eleanor", "Eleanor", "Calder", "Eleanor", "Eleanor"]


def test_a_quote_beside_an_explicit_tag_shares_it():
    from app.services.dialogue_service import extract_dialogue

    blocks = extract_dialogue('<p>"Not here,"&lt;Calder&gt; she said. "Not now."</p>', names=["Calder"])
    assert [(b["content"], b["speaker_name"]) for b in blocks] == [("Not here,", "Calder"), ("Not now.", "Calder")]


def test_a_mention_inside_the_quote_is_not_the_speaker():
    from app.services.dialogue_service import extract_dialogue

    [block] = extract_dialogue('<p>"@Thomas logged a quiet night," Calder said.</p>', names=["Thomas", "Calder"])
    assert block["speaker_name"] == "Calder"


def test_scare_quotes_are_not_dialogue():
    from app.services.dialogue_service import extract_dialogue

    assert extract_dialogue('<p>They called it an "official inquiry" and left.</p>', names=[]) == []
