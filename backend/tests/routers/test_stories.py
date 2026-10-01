def test_overview_carries_goals_and_open_threads(client, db_session, test_user):
    """The Overview's vitals (doc 12 P6) say which threads are open and what the next goal is."""
    from app.models.plot_thread import PlotThread
    from app.models.story import Story

    sid = client.post("/api/stories", json={"title": "Vitals"}).json()["id"]
    story = db_session.get(Story, sid)
    story.goals = [
        {"id": "g1", "text": "Finish act one", "completed": True},
        {"id": "g2", "text": "Name the father", "completed": False},
    ]
    db_session.add_all(
        [
            PlotThread(story_id=sid, name="The logs", status="open"),
            PlotThread(story_id=sid, name="The storm", status="resolved"),
        ]
    )
    db_session.commit()
    ov = client.get(f"/api/stories/{sid}/overview").json()
    assert (ov["goals_done"], ov["goals_total"], ov["next_goal"]) == (1, 2, "Name the father")
    assert ov["open_threads"] == ["The logs"]
    assert "planned" in ov["scenes_by_status"]


def test_lately_leaves_assistant_calls_and_analysis_runs_to_the_chronicle(client, db_session, test_user):
    """doc 13 P6: the Overview's Lately read "Entity scan: 6 character(s)" as news."""
    from app.models.activity_log import ActivityLog

    sid = client.post("/api/stories", json={"title": "Lately"}).json()["id"]
    for category, event, text in [
        ("worldbuilding", "location_created", "Added The Shoals"),
        ("health", "analysis_run", "Entity scan: 6 character(s)"),
        ("ai", "ai_chat", "What happens next?"),
        ("research", "editorial_pass", "Editorial pass"),
    ]:
        db_session.add(
            ActivityLog(user_id=test_user.id, story_id=sid, category=category, event_type=event, description=text)
        )
    db_session.commit()

    lately = [a["description"] for a in client.get(f"/api/stories/{sid}/overview").json()["recent_activity"]]

    assert lately == ["Added The Shoals"]
