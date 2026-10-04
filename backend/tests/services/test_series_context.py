"""The Assistant knows an element's earlier books, never its later ones."""

from app.services.llm.prompts.interviews import build_character_interview_system_prompt
from app.services.series import service
from app.services.series.context import earlier_states, earlier_text
from tests.fixtures.series_factory import empty_book, make_book


def _three_books(db, user):
    one = make_book(db, user)
    two = empty_book(db, user, "The Keeper's Daughter")
    three = empty_book(db, user, "The Last Keeper")
    series = service.create_series(db, user.id, "Keepers")
    for s in (one.story, two, three):
        service.attach_story(db, series, s)
    element = service.lift_element(db, series, "character", one.story.id, one.eleanor.id)
    in_two = service.adopt_into_book(db, series, element, two.id, actor_id=None, client_id=None)
    in_two.personality = "Opening up."
    in_three = service.adopt_into_book(db, series, element, three.id, actor_id=None, client_id=None)
    in_three.personality = "Gone; remembered."
    db.flush()
    return one, in_two, in_three


def test_only_the_books_before(db_session, test_user):
    one, in_two, in_three = _three_books(db_session, test_user)

    assert earlier_states(db_session, "characters", one.eleanor.id) == []
    states = earlier_states(db_session, "characters", in_two.id)
    assert [s["book"] for s in states] == ["Book 1: The Last Lighthouse"]
    assert states[0]["fields"] == {"personality": "Guarded.", "want": "Keep the light burning."}
    assert "Gone; remembered." not in earlier_text(db_session, "characters", in_two.id)
    assert [s["book"] for s in earlier_states(db_session, "characters", in_three.id)] == [
        "Book 1: The Last Lighthouse",
        "Book 2: The Keeper's Daughter",
    ]


def test_what_stays_true_is_not_repeated(db_session, test_user):
    one, in_two, _ = _three_books(db_session, test_user)
    assert "background" not in earlier_text(db_session, "characters", in_two.id)


def test_the_interview_remembers_earlier_books(db_session, test_user):
    one, in_two, _ = _three_books(db_session, test_user)
    earlier = earlier_text(db_session, "characters", in_two.id)
    prompt = build_character_interview_system_prompt(in_two, earlier_books=earlier)
    assert "in the books that came before it" in prompt and "- personality: Guarded." in prompt
    assert "came before it" not in build_character_interview_system_prompt(one.eleanor)
