"""Link mentions on the text, by the grammar (doc 16): the author's words stay, tags are safe."""

from types import SimpleNamespace as NS

from app.services.linking_service import apply_entity_links, suggest_entity_links_preloaded

CAST = [
    NS(id="e", name="Eleanor Vance", aliases=[]),
    NS(id="v", name="The Visitor (Calder)", aliases=[]),
    NS(id="w", name="Will", aliases=[]),
]
PLACES = [NS(id="l", name="The Lighthouse", aliases=[])]


def _found(html):
    return {p["entity_name"]: p["matched_text"] for p in suggest_entity_links_preloaded(html, CAST, PLACES)}


def test_proposes_the_forms_prose_uses_never_an_article():
    found = _found("<p>The Visitor waited. Calder smiled. Eleanor walked up to the lighthouse.</p>")
    assert found == {
        "The Visitor (Calder)": "The Visitor",
        "Eleanor Vance": "Eleanor",
        "The Lighthouse": "the lighthouse",
    }


def test_a_lowercase_word_is_not_a_name_and_a_tag_is_not_prose():
    assert _found('<p>"Hi."&lt;Eleanor Vance&gt; It will rain.</p>') == {}


def test_someone_already_mentioned_is_not_proposed_again():
    assert "Eleanor Vance" not in _found("<p>@Eleanor came in. Eleanor sat.</p>")


def test_linking_keeps_the_words_and_never_touches_a_tag():
    html = '<p>"Hi."&lt;Eleanor&gt; Eleanor waved at <em>the lighthouse</em>.</p>'
    out = apply_entity_links(
        html,
        [
            {"matched_text": "Eleanor", "entity_name": "Eleanor Vance", "entity_type": "character"},
            {"matched_text": "the lighthouse", "entity_name": "The Lighthouse", "entity_type": "location"},
        ],
    )
    assert out == '<p>"Hi."&lt;Eleanor&gt; @Eleanor waved at <em>[[the lighthouse]]</em>.</p>'
