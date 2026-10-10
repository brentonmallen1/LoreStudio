"""The demo screenplay (doc 25): a script story whose scenes are elements and whose length is pages."""

from sqlalchemy.orm import Session

from app.models.story import Story
from app.models.structure import StructureNode
from app.services import script_syntax, seed, seed_screenplay


def test_the_screenplay_demo_is_a_script_in_elements(db_session: Session, monkeypatch):
    monkeypatch.setattr(seed, "engine", db_session.get_bind())
    monkeypatch.setattr(seed_screenplay, "engine", db_session.get_bind())
    seed.seed_structure_templates()
    seed.seed_admin()
    seed_screenplay.seed_screenplay_demo()
    seed_screenplay.seed_screenplay_demo()  # idempotent

    story = db_session.query(Story).filter(Story.title == seed_screenplay.TITLE).one()
    assert story.story_format == "screenplay"
    scenes = (
        db_session.query(StructureNode)
        .filter(StructureNode.story_id == story.id, StructureNode.level_type == "scene")
        .order_by(StructureNode.position)
        .all()
    )
    assert [s.title for s in scenes] == ["The Light", "Knock at the Door", "The Logbook"]

    blocks = script_syntax.scene_blocks(scenes[1].content)
    assert blocks[0] == ("heading", "INT. KEEPER'S COTTAGE - NIGHT")
    assert ("cue", "THE VISITOR") in blocks
    assert {el for el, _ in blocks} == {"heading", "action", "cue", "paren", "dialogue"}
    # Every block reads as the element it was written as: no text a cue would misread.
    assert all(s.line_count == script_syntax.scene_lines(script_syntax.scene_blocks(s.content)) for s in scenes)
    assert all(s.word_count > 0 for s in scenes)

    every = [b for s in scenes for b in script_syntax.scene_blocks(s.content)]
    assert script_syntax.page_count(every) == 2
