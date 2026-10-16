"""A scene's first line (doc 29 D6): what the Outline shows for a scene with no line of its own."""

from app.services.first_line import MAX_CHARS, first_line, first_sentence


def test_the_first_sentence_as_a_reader_meets_it():
    html = "<p>“Wait,”&lt;Eleanor Vance&gt; she said, and @Calder stopped at [[the Gap]]. He turned.</p>"
    assert first_line(html) == "“Wait,” she said, and Calder stopped at the Gap."


def test_a_heading_is_not_the_first_line():
    assert first_line("<h2>The Visitor</h2><p>The knock came at nine.</p>") == "The knock came at nine."
    script = '<p data-el="heading">INT. COTTAGE - NIGHT</p><p data-el="action">Rain on the glass.</p>'
    assert first_line(script) == "Rain on the glass."


def test_a_title_with_a_full_stop_does_not_end_the_sentence():
    assert first_sentence("Dr. Ames came at noon. He was late.") == "Dr. Ames came at noon."


def test_a_long_sentence_ends_at_a_word_with_an_ellipsis():
    line = first_sentence("word " * 80)
    assert line.endswith("…") and len(line) <= MAX_CHARS + 1
    assert not line[:-1].endswith(" ")


def test_nothing_written_is_no_line():
    assert first_line("") == ""
    assert first_line(None) == ""
    assert first_line("<p></p><hr><p> </p>") == ""


def test_only_the_start_of_a_long_scene_is_read():
    html = "<p>It began with the barometer.</p>" + "<p>More.</p>" * 2000
    assert first_line(html) == "It began with the barometer."
