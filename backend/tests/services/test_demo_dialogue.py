"""The Lighthouse's dialogue is attributed, so Numbers' shares cover the talking (doc 14 Q6)."""

from collections import Counter

from sqlalchemy.orm import Session

from app.models.dialogue import DialogueBlock
from app.models.story import Story
from app.models.structure import StructureNode
from app.services import seed
from app.services.dialogue_service import sync_story_dialogue
from app.services.proposals.sources import unattributed


def test_the_demo_leaves_only_one_scene_for_tag_them(db_session: Session, monkeypatch):
    monkeypatch.setattr(seed, "engine", db_session.get_bind())
    seed.seed_structure_templates()
    seed.seed_beat_sheets()
    seed.seed_admin()
    seed.seed_demo_story()
    story = db_session.query(Story).filter(Story.title == "The Last Lighthouse").one()

    sync_story_dialogue(story.id, db_session)

    titles = {n.id: n.title for n in db_session.query(StructureNode).filter(StructureNode.story_id == story.id)}
    speech = (
        db_session.query(DialogueBlock)
        .filter(DialogueBlock.scene_id.in_(list(titles)), DialogueBlock.dialogue_type == "speech")
        .all()
    )
    untagged = Counter(titles[b.scene_id] for b in speech if b.attribution_method == "unattributed")
    assert sum(untagged.values()) <= 5, untagged
    # "Knock at the Door" is left for the Proposals inbox's "Tag them" to show.
    assert untagged["Knock at the Door"] > 0

    # The inbox counts the lines Numbers counts: one proposal, for that scene only.
    [proposal] = unattributed(story.id, db_session, titles)
    assert proposal.where == "Knock at the Door"
    assert proposal.text.startswith(f"{untagged['Knock at the Door']} line")
