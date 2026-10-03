"""Prose HTML read as text and edited as text (doc 16, D4)."""

from app.services.prose_html import Edit, apply_edits, paragraphs

HTML = (
    '<p>"My brother was the captain of the <em>Ardent</em>."&lt;Calder&gt; '
    'She went to <span data-note-id="n1" class="note-anchor">Smith &amp; Sons</span>.</p>'
    "<p></p><p>One<br>two</p>"
)


def test_reads_paragraphs_as_text():
    assert [p.text for p in paragraphs(HTML)] == [
        '"My brother was the captain of the Ardent."<Calder> She went to Smith & Sons.',
        "One\ntwo",
    ]


def test_edits_words_and_leaves_the_markup():
    p = paragraphs(HTML)[0]
    i = p.text.index("Smith & Sons")
    tag = p.text.index("<Calder>")
    html, n = apply_edits(
        HTML,
        [
            Edit(p, i, i + len("Smith & Sons"), "Jones & Co"),
            Edit(p, tag + 1, tag + 7, "The Visitor"),
        ],
    )
    assert n == 2
    assert "&lt;The Visitor&gt;" in html
    assert '<span data-note-id="n1" class="note-anchor">Jones &amp; Co</span>' in html


def test_inserts_after_a_quote_that_spans_italics():
    html = '<p>"the <em>Ardent</em>." she said.</p>'
    p = paragraphs(html)[0]
    end = p.text.index('." ') + 2
    out, n = apply_edits(html, [Edit(p, end, end, "<Calder>")])
    assert (out, n) == ('<p>"the <em>Ardent</em>."&lt;Calder&gt; she said.</p>', 1)


def test_will_not_cut_through_markup():
    html = "<p>the <em>Ardent</em> sank</p>"
    p = paragraphs(html)[0]
    assert apply_edits(html, [Edit(p, 0, len("the Ardent"), "it")]) == (html, 0)
