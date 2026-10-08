"""
Unit tests for import_service.py heuristic structure detection and break application.

These tests cover pure functions — no DB, no pandoc, no LLM.
"""

from app.schemas.import_schemas import BreakPosition, ParsedParagraph
from app.services.import_service import (
    _extract_paragraphs,
    _merge_breaks,
    apply_breaks,
    build_preview_tree,
    detect_structure_heuristic,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_para(index: int, tag: str, text: str) -> ParsedParagraph:
    return ParsedParagraph(
        index=index,
        html=f"<{tag}>{text}</{tag}>",
        text_preview=text[:120],
        tag=tag,
        word_count=len(text.split()),
    )


FREEFORM_LEVELS = [{"name": "Section", "plural": "Sections"}, {"name": "Scene", "plural": "Scenes"}]
THREE_ACT_LEVELS = [
    {"name": "Act", "plural": "Acts"},
    {"name": "Chapter", "plural": "Chapters"},
    {"name": "Scene", "plural": "Scenes"},
]


# ---------------------------------------------------------------------------
# _extract_paragraphs
# ---------------------------------------------------------------------------


class TestExtractParagraphs:
    def test_extracts_headings_and_paragraphs(self):
        html = """<html><body>
            <h1>My Novel</h1>
            <h2>Chapter One</h2>
            <p>It was a dark and stormy night.</p>
            <p>The rain fell in sheets.</p>
        </body></html>"""
        paras, title = _extract_paragraphs(html)
        assert len(paras) == 4
        assert paras[0].tag == "h1"
        assert paras[1].tag == "h2"
        assert paras[2].tag == "p"
        assert title == "My Novel"

    def test_detects_title_from_h1(self):
        html = "<html><body><h1>The Great Story</h1><p>Text.</p></body></html>"
        paras, title = _extract_paragraphs(html)
        assert title == "The Great Story"

    def test_handles_no_headings(self):
        html = "<html><body><p>Paragraph one.</p><p>Paragraph two.</p></body></html>"
        paras, title = _extract_paragraphs(html)
        assert len(paras) == 2
        assert title is None

    def test_includes_hr_tag(self):
        html = "<html><body><p>Before.</p><hr/><p>After.</p></body></html>"
        paras, _ = _extract_paragraphs(html)
        tags = [p.tag for p in paras]
        assert "hr" in tags

    def test_word_counts_are_accurate(self):
        html = "<html><body><p>one two three four five</p></body></html>"
        paras, _ = _extract_paragraphs(html)
        assert paras[0].word_count == 5


# ---------------------------------------------------------------------------
# detect_structure_heuristic
# ---------------------------------------------------------------------------


class TestDetectStructureHeuristic:
    def test_h1_creates_level_0_break(self):
        paragraphs = [
            make_para(0, "p", "Opening prose."),
            make_para(1, "h1", "Part One"),
            make_para(2, "p", "Body text."),
        ]
        breaks = detect_structure_heuristic(paragraphs)
        level0 = [b for b in breaks if b.level == 0]
        assert len(level0) == 1
        assert level0[0].after_index == 0  # break before the h1

    def test_h2_creates_level_1_break(self):
        paragraphs = [
            make_para(0, "p", "Prologue."),
            make_para(1, "h2", "Chapter One"),
            make_para(2, "p", "Story begins."),
        ]
        breaks = detect_structure_heuristic(paragraphs)
        level1 = [b for b in breaks if b.level == 1]
        assert len(level1) == 1

    def test_h3_creates_level_2_break(self):
        paragraphs = [
            make_para(0, "p", "text"),
            make_para(1, "h3", "Scene heading"),
            make_para(2, "p", "more text"),
        ]
        breaks = detect_structure_heuristic(paragraphs)
        assert any(b.level == 2 for b in breaks)

    def test_hr_creates_scene_break(self):
        paragraphs = [
            make_para(0, "p", "Scene one."),
            make_para(1, "hr", ""),
            make_para(2, "p", "Scene two."),
        ]
        breaks = detect_structure_heuristic(paragraphs)
        assert len(breaks) == 1
        assert breaks[0].after_index == 0

    def test_star_break_in_paragraph(self):
        paragraphs = [
            make_para(0, "p", "Before the break."),
            make_para(1, "p", "* * *"),
            make_para(2, "p", "After the break."),
        ]
        breaks = detect_structure_heuristic(paragraphs)
        assert len(breaks) == 1
        assert breaks[0].level == 2

    def test_no_breaks_on_simple_prose(self):
        paragraphs = [
            make_para(0, "p", "First paragraph."),
            make_para(1, "p", "Second paragraph."),
            make_para(2, "p", "Third paragraph."),
        ]
        breaks = detect_structure_heuristic(paragraphs)
        assert breaks == []

    def test_first_heading_does_not_produce_negative_break(self):
        paragraphs = [
            make_para(0, "h1", "Title"),
            make_para(1, "p", "Text."),
        ]
        breaks = detect_structure_heuristic(paragraphs)
        # break after_index would be -1 which should be filtered
        assert all(b.after_index >= 0 for b in breaks)

    def test_heuristic_source_label(self):
        paragraphs = [
            make_para(0, "p", "text"),
            make_para(1, "h2", "Chapter"),
            make_para(2, "p", "text"),
        ]
        breaks = detect_structure_heuristic(paragraphs)
        assert all(b.source == "heuristic" for b in breaks)

    def test_confidence_is_1_for_headings(self):
        paragraphs = [
            make_para(0, "p", "text"),
            make_para(1, "h1", "Part"),
            make_para(2, "p", "text"),
        ]
        breaks = detect_structure_heuristic(paragraphs)
        assert breaks[0].confidence == 1.0


# ---------------------------------------------------------------------------
# apply_breaks
# ---------------------------------------------------------------------------


class TestApplyBreaks:
    def test_produces_sections_from_heading_breaks(self):
        paragraphs = [
            make_para(0, "h1", "Act One"),
            make_para(1, "p", "Opening scene."),
            make_para(2, "h1", "Act Two"),
            make_para(3, "p", "Rising action."),
        ]
        breaks = detect_structure_heuristic(paragraphs)
        sections = apply_breaks(paragraphs, breaks, THREE_ACT_LEVELS)
        assert len(sections) == 2
        assert sections[0].title == "Act One"
        assert sections[1].title == "Act Two"

    def test_empty_paragraphs_returns_empty(self):
        sections = apply_breaks([], [], FREEFORM_LEVELS)
        assert sections == []

    def test_no_breaks_returns_single_section(self):
        paragraphs = [
            make_para(0, "p", "Text one."),
            make_para(1, "p", "Text two."),
        ]
        sections = apply_breaks(paragraphs, [], FREEFORM_LEVELS)
        assert len(sections) == 1
        assert sections[0].word_count == 4  # "Text one." + "Text two."

    def test_hr_paragraphs_dropped_from_content(self):
        paragraphs = [
            make_para(0, "p", "Scene one text."),
            make_para(1, "hr", ""),
            make_para(2, "p", "Scene two text."),
        ]
        breaks = detect_structure_heuristic(paragraphs)
        sections = apply_breaks(paragraphs, breaks, FREEFORM_LEVELS)
        # The hr should not appear in any section's content
        for sec in sections:
            assert "<hr" not in sec.content_html

    def test_scene_break_markers_dropped_from_content(self):
        paragraphs = [
            make_para(0, "p", "Before."),
            make_para(1, "p", "* * *"),
            make_para(2, "p", "After."),
        ]
        breaks = detect_structure_heuristic(paragraphs)
        sections = apply_breaks(paragraphs, breaks, FREEFORM_LEVELS)
        combined = " ".join(sec.content_html for sec in sections)
        assert "* * *" not in combined

    def test_heading_used_as_title_not_content(self):
        paragraphs = [
            make_para(0, "h2", "Chapter Name"),
            make_para(1, "p", "Chapter content."),
        ]
        breaks = detect_structure_heuristic(paragraphs)
        sections = apply_breaks(paragraphs, breaks, THREE_ACT_LEVELS)
        # Even with no initial break, we hit the heading at index 0
        # The heading should not appear as prose content
        for sec in sections:
            assert "<h2>" not in sec.content_html

    def test_position_counters_are_sequential(self):
        paragraphs = [
            make_para(0, "h1", "Part 1"),
            make_para(1, "p", "A"),
            make_para(2, "h1", "Part 2"),
            make_para(3, "p", "B"),
        ]
        breaks = detect_structure_heuristic(paragraphs)
        sections = apply_breaks(paragraphs, breaks, THREE_ACT_LEVELS)
        assert sections[0].paragraph_start <= sections[0].paragraph_end
        assert sections[1].paragraph_start <= sections[1].paragraph_end


# ---------------------------------------------------------------------------
# build_preview_tree
# ---------------------------------------------------------------------------


class TestBuildPreviewTree:
    def test_empty_sections_returns_warning(self):
        tree = build_preview_tree([], [], "sess-1", "freeform", FREEFORM_LEVELS, "txt", None)
        assert "No content" in tree.warnings[0]

    def test_single_large_block_warns(self):
        long_paras = [make_para(i, "p", "word " * 50) for i in range(100)]
        breaks = detect_structure_heuristic(long_paras)
        sections = apply_breaks(long_paras, breaks, FREEFORM_LEVELS)
        tree = build_preview_tree(sections, long_paras, "sess-1", "freeform", FREEFORM_LEVELS, "txt", None)
        assert any("unstructured" in w.lower() or "no detectable" in w.lower() for w in tree.warnings)

    def test_nodes_have_correct_level_types(self):
        paragraphs = [
            make_para(0, "h1", "Act One"),
            make_para(1, "p", "Scene text."),
        ]
        breaks = detect_structure_heuristic(paragraphs)
        sections = apply_breaks(paragraphs, breaks, THREE_ACT_LEVELS)
        tree = build_preview_tree(sections, paragraphs, "s", "three-act", THREE_ACT_LEVELS, "docx", "My Story")
        assert tree.detected_title == "My Story"
        level0_nodes = [n for n in tree.nodes if n.level == 0]
        assert all(n.level_type == "act" for n in level0_nodes)

    def test_parent_child_relationships(self):
        paragraphs = [
            make_para(0, "h1", "Act One"),
            make_para(1, "h2", "Chapter One"),
            make_para(2, "p", "Scene text."),
        ]
        breaks = detect_structure_heuristic(paragraphs)
        sections = apply_breaks(paragraphs, breaks, THREE_ACT_LEVELS)
        tree = build_preview_tree(sections, paragraphs, "s", "three-act", THREE_ACT_LEVELS, "docx", None)
        acts = [n for n in tree.nodes if n.level == 0]
        chapter_nodes = [n for n in tree.nodes if n.level == 1]
        assert len(acts) == 1 and len(chapter_nodes) == 1
        # The chapter's parent is the act
        assert chapter_nodes[0].parent_id == acts[0].id

    def test_word_count_totals(self):
        paragraphs = [make_para(i, "p", "one two three") for i in range(5)]
        breaks = detect_structure_heuristic(paragraphs)
        sections = apply_breaks(paragraphs, breaks, FREEFORM_LEVELS)
        tree = build_preview_tree(sections, paragraphs, "s", "freeform", FREEFORM_LEVELS, "txt", None)
        assert tree.total_word_count == 15  # 5 paras * 3 words


# ---------------------------------------------------------------------------
# _merge_breaks
# ---------------------------------------------------------------------------


class TestMergeBreaks:
    def test_heuristic_breaks_preserved(self):
        heuristic = [
            BreakPosition(after_index=2, level=1, source="heuristic", confidence=1.0),
        ]
        ai = []
        merged = _merge_breaks(heuristic, ai)
        assert len(merged) == 1
        assert merged[0].source == "heuristic"

    def test_ai_breaks_added_when_no_conflict(self):
        heuristic = [
            BreakPosition(after_index=2, level=1, source="heuristic", confidence=1.0),
        ]
        ai = [
            BreakPosition(after_index=8, level=2, source="ai", confidence=0.75),
        ]
        merged = _merge_breaks(heuristic, ai)
        assert len(merged) == 2

    def test_ai_break_skipped_when_near_heuristic(self):
        heuristic = [
            BreakPosition(after_index=5, level=1, source="heuristic", confidence=1.0),
        ]
        ai = [
            BreakPosition(after_index=5, level=2, source="ai", confidence=0.75),  # same index
        ]
        merged = _merge_breaks(heuristic, ai)
        assert len(merged) == 1  # AI break was suppressed

    def test_merged_breaks_are_sorted(self):
        heuristic = [
            BreakPosition(after_index=10, level=1, source="heuristic", confidence=1.0),
        ]
        ai = [
            BreakPosition(after_index=3, level=2, source="ai", confidence=0.75),
        ]
        merged = _merge_breaks(heuristic, ai)
        indices = [b.after_index for b in merged]
        assert indices == sorted(indices)
