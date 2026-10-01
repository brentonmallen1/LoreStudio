def test_scene_excerpts_are_words_not_markup(client, db_session, test_user):
    """doc 13 P7: the palette showed "…noon.</p><p>Eleanor noted…"."""
    from app.models.story import Story
    from app.models.structure import StructureNode

    story = Story(user_id=test_user.id, title="Excerpts")
    db_session.add(story)
    db_session.flush()
    db_session.add(
        StructureNode(
            story_id=story.id, title="The Light", level=0, level_type="scene", position=0,
            content="<p>The barometer had been falling since noon.</p><p>Eleanor noted it in the log.</p>",
        )
    )  # fmt: skip
    db_session.commit()

    scenes = [r for r in client.get("/api/search", params={"q": "Eleanor"}).json() if r["type"] == "scene"]

    assert scenes and "<" not in scenes[0]["excerpt"]
    assert "Eleanor noted it" in scenes[0]["excerpt"]
