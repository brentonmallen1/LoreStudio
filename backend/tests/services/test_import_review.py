"""Every bit of prose is a scene, and the review step's edits (pure functions: no DB, no LLM)."""

from app.schemas.import_schemas import NodeAdjustment
from app.services.import_review import apply_adjustment, carry_titles, give_prose_scenes, prose_sections
from app.services.import_service import _Section, apply_breaks, build_preview_tree, detect_structure_heuristic
from tests.services.test_import_service import FREEFORM_LEVELS, THREE_ACT_LEVELS, make_para


def _sections(paragraphs, levels=THREE_ACT_LEVELS):
    return prose_sections(paragraphs, detect_structure_heuristic(paragraphs), levels)


def _shape(sections):
    return [(s.level, s.title, [p.index for p in s.content_paras]) for s in sections]


def _tree(sections, paragraphs, levels=THREE_ACT_LEVELS):
    return build_preview_tree(sections, paragraphs, "s", "three-act", levels, "docx", None)


class TestProseScenes:
    def test_the_text_before_the_first_break_is_the_first_scene(self):
        paragraphs = [
            make_para(0, "h1", "Act One"),
            make_para(1, "h2", "Lay of the Land"),
            make_para(2, "p", "Pre-dawn on the farm."),
            make_para(3, "p", "* * *"),
            make_para(4, "p", "The Service."),
        ]
        assert _shape(_sections(paragraphs)) == [
            (0, "Act One", []),
            (1, "Lay of the Land", []),
            (2, "Lay of the Land", [2]),
            (2, "", [4]),
        ]

    def test_a_chapter_without_breaks_gets_one_scene(self):
        paragraphs = [
            make_para(0, "h2", "Beginning the Investigation"),
            make_para(1, "p", "Newcomb interviews the crew."),
            make_para(2, "p", "Flashbacks."),
        ]
        assert _shape(_sections(paragraphs)) == [
            (1, "Beginning the Investigation", []),
            (2, "Beginning the Investigation", [1, 2]),
        ]

    def test_an_act_holding_prose_gets_a_chapter_and_a_scene(self):
        paragraphs = [
            make_para(0, "h1", "Opening Image"),
            make_para(1, "p", "Fire on the beach."),
            make_para(2, "h2", "Fade In"),
            make_para(3, "p", "Dunes."),
        ]
        assert _shape(_sections(paragraphs)) == [
            (0, "Opening Image", []),
            (1, "Opening Image", []),
            (2, "Opening Image", [1]),
            (1, "Fade In", []),
            (2, "Fade In", [3]),
        ]

    def test_two_levels_work_the_same_way(self):
        paragraphs = [make_para(0, "h1", "Part One"), make_para(1, "p", "Text.")]
        assert _shape(_sections(paragraphs, FREEFORM_LEVELS)) == [(0, "Part One", []), (1, "Part One", [1])]

    def test_a_flat_template_is_left_alone(self):
        paragraphs = [make_para(0, "p", "Text.")]
        flat = [{"name": "Scene", "plural": "Scenes"}]
        sections = apply_breaks(paragraphs, [], flat)
        assert give_prose_scenes(sections, flat) == sections

    def test_two_breaks_in_a_row_make_no_empty_scene(self):
        paragraphs = [
            make_para(0, "h2", "Chapter"),
            make_para(1, "p", "One."),
            make_para(2, "p", "* * *"),
            make_para(3, "p", "* * *"),
            make_para(4, "p", "Two."),
        ]
        sections = _sections(paragraphs)
        assert [s.word_count for s in sections if s.level == 2] == [1, 1]

    def test_a_heading_only_node_takes_no_paragraphs(self):
        """A chapter's range is its heading alone, so the story gets no prose on it."""
        paragraphs = [make_para(0, "h2", "Chapter"), make_para(1, "p", "Prose.")]
        nodes = _tree(_sections(paragraphs), paragraphs).nodes
        assert [(n.level, n.paragraph_start, n.paragraph_end) for n in nodes] == [(1, 0, 0), (2, 1, 1)]
        assert nodes[1].parent_id == nodes[0].id

    def test_a_section_with_nothing_in_it_takes_no_paragraph(self):
        """It used to fall back to 0-0 and copy the document's first paragraph."""
        empty = _Section(2, "heuristic", 1.0, anchor=7)
        assert (empty.paragraph_start, empty.paragraph_end) == (7, 6)


def _preview(paragraphs):
    return _tree(_sections(paragraphs), paragraphs)


PARAS = [
    make_para(0, "h2", "Chapter"),
    make_para(1, "p", "One."),
    make_para(2, "p", "* * *"),
    make_para(3, "p", "Two."),
    make_para(4, "h2", "Next"),
    make_para(5, "p", "Three."),
]


class TestMergeUp:
    def test_a_scene_merges_into_the_scene_before(self):
        tree = _preview(PARAS)
        second = [n for n in tree.nodes if n.level == 2][1]
        out = apply_adjustment(tree, PARAS, NodeAdjustment(action="merge_up", node_id=second.id))
        scenes = [n for n in out.nodes if n.level == 2]
        assert [(s.paragraph_start, s.paragraph_end, s.word_count) for s in scenes] == [(1, 3, 2), (5, 5, 1)]

    def test_a_chapter_merges_into_the_chapter_before_without_taking_prose(self):
        tree = _preview(PARAS)
        nxt = next(n for n in tree.nodes if n.title == "Next" and n.level == 1)
        out = apply_adjustment(tree, PARAS, NodeAdjustment(action="merge_up", node_id=nxt.id))
        chapters = [n for n in out.nodes if n.level == 1]
        assert [(c.paragraph_start, c.paragraph_end, c.word_count) for c in chapters] == [(0, 0, 0)]
        assert all(n.parent_id == chapters[0].id for n in out.nodes if n.level == 2)

    def test_the_first_scene_has_nothing_to_merge_into(self):
        tree = _preview(PARAS)
        first = next(n for n in tree.nodes if n.level == 2)
        out = apply_adjustment(tree, PARAS, NodeAdjustment(action="merge_up", node_id=first.id))
        assert out.nodes == tree.nodes


class TestCarryTitles:
    def test_a_rename_survives_a_new_split(self):
        old = _preview(PARAS)
        renamed = apply_adjustment(
            old, PARAS, NodeAdjustment(action="rename", node_id=old.nodes[0].id, new_title="The Farm")
        )
        fresh = _preview(PARAS)
        out = carry_titles(renamed, fresh)
        assert out.nodes[0].title == "The Farm"
        assert out.nodes[0].source == "user"
        assert [n.title for n in out.nodes[1:]] == [n.title for n in fresh.nodes[1:]]
