"""Where a long scene's time jumps (doc 29 D6): the phrases, kept in one place and held here."""

import pytest

from app.services.time_jumps import LONG_SCENE_WORDS, is_long, time_jump, time_jumps


@pytest.mark.parametrize(
    ("text", "phrase"),
    [
        ("By morning, the storm had blown itself out.", "By morning"),
        ("By nightfall the boat was gone.", "By nightfall"),
        ("The next day she went down to the harbour.", "The next day"),
        ("The following morning, nothing.", "The following morning"),
        ("Next morning the sea was glass.", "Next morning"),
        ("The night after, she dreamed of it.", "The night after"),
        ("Three days on, the letter came.", "Three days on"),
        ("Two weeks later she wrote back.", "Two weeks later"),
        ("A week passed.", "A week passed"),
        ("Half an hour later he was still talking.", "Half an hour later"),
        ("Twenty minutes later, I shift.", "Twenty minutes later"),
        ("Weeks passed before she opened it.", "Weeks passed"),
        ("Days later the gulls came back.", "Days later"),
        ("Later that night, the knock.", "Later that night"),
        ("Some time later she woke.", "Some time later"),
        ("When morning came the beach was empty.", "When morning came"),
        ("  by dawn she had decided", "by dawn"),
    ],
)
def test_a_paragraph_that_opens_on_a_jump_in_time(text, phrase):
    assert time_jump(text) == phrase


@pytest.mark.parametrize(
    "text",
    [
        "Byron came up the stairs.",
        "The next thing she knew, the lamp was out.",
        "She said she would come back the next day.",
        "“By morning,” he said, “it will be over.”",
        "Later, she thought, she would tell him.",
        "Morning glory grew on the wall.",
        "The days were short now.",
        "",
    ],
)
def test_anything_else_is_not(text):
    assert time_jump(text) is None


def test_only_paragraphs_after_the_first_and_never_a_heading():
    html = (
        "<p>By morning the boat was there.</p>"
        "<h2>Three days later</h2>"
        "<p>She watched it all day.</p>"
        "<p>The next day, @Calder came up the path with the post.</p>"
    )
    jumps = time_jumps(html)
    assert [(j.index, j.phrase) for j in jumps] == [(3, "The next day")]
    # The passage is the paragraph as the editor holds it, to find it there.
    assert jumps[0].passage == "The next day, @Calder came up the path"


def test_a_long_scene_is_the_rule_said_where_the_offer_shows():
    assert not is_long(LONG_SCENE_WORDS - 1)
    assert is_long(LONG_SCENE_WORDS)
    assert not is_long(None)
