"""
One read for the whole book: who is in each scene, where it is set, which threads it
carries (refactor doc 11, phase 1).

The structure list leaves the prose out on purpose, so the story strip and the side panel
could not tell who is on a page without fetching every scene. This answers for all of
them at once, from the same signals Codex presence uses: the point of view, the author's
own "who is here" answers, and names in the prose. Read-only, so nothing is logged.
"""

import re
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_user
from ..database import get_db
from ..models.character import Character
from ..models.location import Location, ScenePresence, SceneSetting
from ..models.plot_thread import PlotThread, PlotThreadAppearance
from ..models.story import Story
from ..models.structure import StructureNode
from ..models.user import User
from ..schemas.scene_cast import SceneCastEntry, SceneCastOut
from ..services.codex.presence import known_as, name_patterns, plain_text

router = APIRouter()

OPENING_CHARS = 160
_SETTING = re.compile(r"\[\[([^\]]+)\]\]")


def _opening(text: str) -> str:
    words = " ".join(text.split())
    if len(words) <= OPENING_CHARS:
        return words
    cut = words[:OPENING_CHARS].rsplit(" ", 1)[0]
    return f"{cut}…"


def _leaf_scenes(nodes: list[StructureNode]) -> list[StructureNode]:
    parents = {n.parent_id for n in nodes if n.parent_id}
    return [n for n in nodes if n.id not in parents]


@router.get("/stories/{story_id}/scene-cast", response_model=SceneCastOut)
def get_scene_cast(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    story = db.query(Story).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    nodes = db.query(StructureNode).filter(StructureNode.story_id == story_id).order_by(StructureNode.position).all()
    scenes = _leaf_scenes(nodes)
    scene_ids = [s.id for s in scenes]
    characters = db.query(Character).filter(Character.story_id == story_id).all()
    patterns = name_patterns({c.id: known_as(c) for c in characters})
    locations = db.query(Location).filter(Location.story_id == story_id).all()
    # A place answers to its name and to its aliases (a found place merged into it, doc 13 P4).
    location_by_name = {
        name.strip().lower(): loc.id for loc in locations for name in [loc.name, *(loc.aliases or [])] if name
    }

    authored: dict[str, list[ScenePresence]] = {}
    for row in db.query(ScenePresence).filter(ScenePresence.node_id.in_(scene_ids)).all() if scene_ids else []:
        authored.setdefault(row.node_id, []).append(row)
    settings: dict[str, list[str]] = {}
    for row in db.query(SceneSetting).filter(SceneSetting.node_id.in_(scene_ids)).all() if scene_ids else []:
        settings.setdefault(row.node_id, []).append(row.location_id)
    threads: dict[str, list[str]] = {}
    appearances = (
        db.query(PlotThreadAppearance)
        .join(PlotThread, PlotThread.id == PlotThreadAppearance.thread_id)
        .filter(PlotThread.story_id == story_id)
        .all()
    )
    for row in appearances:
        threads.setdefault(row.node_id, []).append(row.thread_id)

    out: list[SceneCastEntry] = []
    for scene in scenes:
        text = plain_text(scene.content or "")
        counts: Counter[str] = Counter()
        for cid, pats in patterns.items():
            hits = sum(len(p.findall(text)) for p in pats)
            if hits:
                counts[cid] = hits
        # The author's answer for a scene outranks anything read off the page: someone
        # marked absent is out even if named, someone placed here is in even if not.
        for row in authored.get(scene.id, []):
            if row.role == "absent":
                counts.pop(row.character_id, None)
            else:
                counts[row.character_id] = max(counts.get(row.character_id, 0), 1) + 1000
        # The point of view is in the scene whether or not the prose says their name:
        # a first-person narrator rarely does. An "absent" answer still wins.
        pov = scene.pov_character_id or story.pov_character_id
        absent = {row.character_id for row in authored.get(scene.id, []) if row.role == "absent"}
        ordered = [cid for cid, _ in counts.most_common()]
        if pov and pov not in absent:
            ordered = [pov, *[c for c in ordered if c != pov]]

        place_ids = list(settings.get(scene.id, []))
        for name in _SETTING.findall(scene.content or ""):
            lid = location_by_name.get(name.strip().lower())
            if lid and lid not in place_ids:
                place_ids.append(lid)

        out.append(
            SceneCastEntry(
                node_id=scene.id,
                character_ids=ordered,
                location_ids=place_ids,
                thread_ids=threads.get(scene.id, []),
                beat_id=scene.beat_id,
                status=scene.status,
                word_count=scene.word_count or 0,
                opening=_opening(text),
            )
        )
    return SceneCastOut(scenes=out)
