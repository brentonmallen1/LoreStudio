"""The review step, Quick (doc 20 P3, R4): example sentences, each a case the review must get right."""

from types import SimpleNamespace

from app.services.pronoun_review import Person, patterns_for, pronoun_set, review_scene


def _who(cid, name, pronouns):
    return SimpleNamespace(id=cid, name=name, aliases=[], pronouns=pronouns)


MARGARET = _who("m", "Margaret", "she/her")
ELEANOR = _who("e", "Eleanor", "she/her")
TAM = _who("t", "Tam", "he/him")
ASH = _who("a", "Ash", "they/them")


def _review(text, me, cast, old, new, **kw):
    html = "".join(f"<p>{p}</p>" for p in text.split("\n"))
    on_page = [Person(c.id, pronoun_set(c.pronouns)) for c in cast]
    return review_scene(
        "n1", html, me, old_set=pronoun_set(old), new_set=pronoun_set(new), on_page=on_page,
        patterns=patterns_for(cast), **kw,
    )  # fmt: skip


def _afters(props, kind="pronoun"):
    return [(p.after, p.sure) for p in props if p.kind == kind]


def test_the_only_woman_on_the_page_is_sure_and_her_verb_agrees():
    props = _review("Margaret walked to the shore. She was tired.", MARGARET, [MARGARET, TAM], "she/her", "they/them")
    assert _afters(props) == [("They were tired.", True)]


def test_her_is_possessive_before_a_noun_and_an_object_after_a_preposition():
    props = _review("Margaret gave her coat to her.", MARGARET, [MARGARET], "she/her", "they/them")
    assert _afters(props)[0][0] == "Margaret gave their coat to them."


def test_shes_becomes_theyre_and_a_present_verb_loses_its_s():
    props = _review("Margaret paused. She's tired. She walks home.", MARGARET, [MARGARET], "she/her", "they/them")
    assert [a for a, _ in _afters(props)] == ["They're tired.", "They walk home."]


def test_someone_elses_dialect_is_left_as_written():
    text = '"They was here first," said Tam. Margaret nodded. She was cold.'
    props = _review(text, MARGARET, [MARGARET, TAM], "she/her", "they/them")
    assert [a for a, _ in _afters(props)] == ["They were cold."]
    assert not any(e.was == "was" and e.start < text.index("said") for p in props for e in p.edits)


def test_two_women_on_the_page_make_it_sure_only_after_her_own_name():
    text = "Margaret came in. She sat by the fire.\nEleanor looked up. She smiled."
    props = _review(text, MARGARET, [MARGARET, ELEANOR], "she/her", "they/them")
    assert _afters(props) == [("They sat by the fire.", True), ("They smiled.", False)]


def test_a_review_for_slips_offers_only_what_follows_their_name():
    text = "Ash came in. She sat down.\nEleanor looked up. She smiled."
    props = _review(text, ASH, [ASH, ELEANOR], "she/her", "they/them", named_only=True)
    assert [a for a, _ in _afters(props)] == ["They sat down."]


def test_they_to_she_makes_the_verb_singular_after_their_name():
    props = _review("Ash came in. They walk home.", ASH, [ASH], "they/them", "she/her")
    assert _afters(props) == [("She walks home.", True)]


def test_a_they_with_no_name_before_it_may_be_plural_so_it_is_unsure():
    props = _review("The gulls circled. They were loud.", ASH, [ASH], "they/them", "she/her")
    assert _afters(props) == [("She was loud.", False)]


def test_dialogue_is_unsure():
    props = _review('Margaret left. "She was always late," said Tam.', MARGARET, [MARGARET, TAM], "she/her", "he/him")
    assert _afters(props)[0][1] is False


def test_gendered_words_are_listed_never_rewritten():
    props = _review("Margaret, the old woman, laughed.", MARGARET, [MARGARET], "she/her", "they/them")
    gendered = [p for p in props if p.kind == "gendered"]
    assert gendered and gendered[0].note == "woman" and gendered[0].edits == []


def test_a_name_change_finds_mentions_and_plain_text():
    html_text = "@Eleanor Vance waved. Later Eleanor Vance smiled."
    props = _review(html_text, ELEANOR, [ELEANOR], "", "", old_name="Eleanor Vance", new_name="Nell Vance")
    assert [p.after for p in props if p.kind == "name"] == [
        "@Nell Vance waved.",
        "Later Nell Vance smiled.",
    ]


def test_any_pronouns_and_name_only_make_no_pronoun_proposals():
    assert pronoun_set("any pronouns") is None and pronoun_set("name only") is None
    assert pronoun_set("they/them") == "they" and pronoun_set("Xe/Xem") == "xe"
