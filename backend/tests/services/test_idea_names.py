from app.services.idea_names import idea_names


def test_people_and_places_the_story_does_not_have():
    names = idea_names(
        {
            "a": "Nell runs the ferry to Portsmouth every morning.",
            "b": "Eleanor Vance meets Calder at the lighthouse.",
        },
        known=["Eleanor Vance", "The Visitor (Calder)"],
    )
    assert {"name": "Nell", "kind": "character"} in names["a"]
    assert {"name": "Portsmouth", "kind": "place"} in names["a"]
    # Known by full name, first name or bracketed name: nothing to suggest.
    assert names["b"] == []


def test_ordinary_words_that_open_a_sentence_are_not_names():
    names = idea_names({"a": "Storms come in autumn. Nobody stays for the winter."}, known=[])
    assert names["a"] == []
