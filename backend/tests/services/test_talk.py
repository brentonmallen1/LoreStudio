"""Talking to each other (doc 20 P7, R7): exchanges from dialogue blocks, never a score."""

from types import SimpleNamespace

from app.services.talk import default_group, exchanges, gender_values


def _line(who, para, pos=0, text="…"):
    return SimpleNamespace(character_id=who, paragraph_index=para, position_in_paragraph=pos, content=text)


W = {"ann", "bea", "cat"}


def test_two_women_talking_in_turn_are_one_exchange():
    found = exchanges([_line("ann", 0), _line("bea", 1), _line("ann", 2)], W)
    assert [(e.speakers, len(e.lines)) for e in found] == [(["ann", "bea"], 3)]


def test_someone_outside_the_group_speaking_between_breaks_it():
    found = exchanges([_line("ann", 0), _line("tom", 1), _line("bea", 2)], W)
    assert found == []


def test_an_unattributed_line_breaks_it_too():
    assert exchanges([_line("ann", 0), _line(None, 1), _line("bea", 2)], W) == []


def test_one_woman_speaking_twice_is_not_talking_to_another():
    assert exchanges([_line("ann", 0), _line("ann", 1)], W) == []


def test_three_speakers_and_order_within_a_paragraph():
    found = exchanges([_line("cat", 1, 1), _line("ann", 0), _line("bea", 1, 0)], W)
    assert found[0].speakers == ["ann", "bea", "cat"]


def test_an_exchange_is_known_by_its_words():
    one = exchanges([_line("ann", 0, text="a"), _line("bea", 1, text="b")], W)[0]
    same = exchanges([_line("ann", 0, text="a"), _line("bea", 1, text="b")], W)[0]
    changed = exchanges([_line("ann", 0, text="a"), _line("bea", 1, text="c")], W)[0]
    assert one.id == same.id != changed.id


def test_the_group_starts_as_the_values_that_say_woman():
    people = [SimpleNamespace(gender=g) for g in ("woman", "Woman ", "trans woman", "man", "non-binary", "")]
    values = gender_values(people)
    assert values[0] == ("woman", 2)
    assert default_group([v for v, _ in values]) == ["woman", "trans woman"]
