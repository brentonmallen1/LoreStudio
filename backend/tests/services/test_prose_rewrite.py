"""Rewrites on the text, by the grammar (doc 16, D4)."""

from app.services.prose_rewrite import normalize_quotes, rename, replace_words, tag_lines


def test_tag_them_finds_a_line_with_italics_and_tags_it_once():
    html = "<p>“My brother was on the <em>Ardent</em>.” She waited. “My brother was on the <em>Ardent</em>.”</p>"
    out, n = tag_lines(html, [("My brother was on the Ardent.", "Calder")])
    assert n == 1
    assert out.count("&lt;Calder&gt;") == 1
    assert "<em>Ardent</em>.”&lt;Calder&gt; She waited." in out


def test_tag_them_writes_a_name_safely():
    out, _ = tag_lines('<p>"Hi."</p>', [("Hi.", "Smith & Sons \\1")])
    assert out == '<p>"Hi."&lt;Smith &amp; Sons \\1&gt;</p>'


def test_rename_reaches_every_use_but_no_one_else():
    html = (
        '<p>"Hi."&lt;Eleanor Vance&gt; @Eleanor Vance’s lamp. @Eleanor Vance</p>'
        "<p>Eleanor Vance walked. @Eleanor Vanceworth stayed.</p>"
    )
    out, n = rename(html, "character", "Eleanor Vance", "Nell Vance")
    assert n == 3
    assert out == (
        '<p>"Hi."&lt;Nell Vance&gt; @Nell Vance’s lamp. @Nell Vance</p>'
        "<p>Eleanor Vance walked. @Eleanor Vanceworth stayed.</p>"
    )


def test_rename_a_place_with_an_ampersand():
    out, n = rename("<p>At [[Smith &amp; Sons]].</p>", "location", "Smith & Sons", "Jones & Co")
    assert (out, n) == ("<p>At [[Jones &amp; Co]].</p>", 1)


def test_replace_leaves_tags_alone_and_takes_any_replacement():
    html = '<p>"Not here."&lt;Calder&gt; Calder left.</p>'
    assert replace_words(html, "Calder", r"Cal\1") == ('<p>"Not here."&lt;Calder&gt; Cal\\1 left.</p>', 1)


def test_curling_reads_across_italics_and_leaves_names_alone():
    html = "<p>\"the <em>Ardent</em>\"&lt;O'Brien&gt; @O'Brien's coat, isn't it</p>"
    out, n = normalize_quotes(html, "curly")
    # The name keeps its spelling; the possessive after it is prose, and curls.
    assert out == "<p>“the <em>Ardent</em>”&lt;O'Brien&gt; @O'Brien’s coat, isn’t it</p>"
    assert n == 4
