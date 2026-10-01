""" "Same as…": merge a place found in the prose into one the author has (doc 13 P4).

Everything that pointed at the found place points at the other one; the found place's name
joins the other's aliases so the prose that calls it that still resolves; the found place
goes. One change-log batch, so one Undo puts it all back.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from ..models.location import Location, SceneSetting
from ..models.location_travel import LocationTravel
from . import change_log


class CannotMerge(Exception):
    pass


def merge_location(stub: Location, into: Location, db: Session, actor: str, client: str | None) -> Location:
    if stub.id == into.id:
        raise CannotMerge("A place cannot be the same as itself")
    if stub.story_id != into.story_id:
        raise CannotMerge("Those places are in different stories")
    if _within(into, stub, db):
        raise CannotMerge(f"{into.name} is inside {stub.name}")
    batch = str(uuid.uuid4())
    story = stub.story_id
    label = f"{stub.name} is {into.name}"

    def update(obj, data: dict, entity_type: str) -> None:
        change_log.record_update(
            db, obj, data, entity_type=entity_type, story_id=story, label=label, actor_id=actor, client_id=client,
            batch_id=batch,
        )  # fmt: skip
        for key, value in data.items():
            setattr(obj, key, value)

    already = {s.node_id for s in db.query(SceneSetting).filter(SceneSetting.location_id == into.id)}
    for setting in db.query(SceneSetting).filter(SceneSetting.location_id == stub.id).all():
        if setting.node_id in already:
            change_log.record_row_delete(
                db, setting, "scene_settings", entity_type="scene_setting", story_id=story, label=label,
                actor_id=actor, client_id=client, batch_id=batch,
            )  # fmt: skip
            db.delete(setting)
        else:
            update(setting, {"location_id": into.id}, "scene_setting")
    for child in db.query(Location).filter(Location.parent_id == stub.id).all():
        update(child, {"parent_id": into.id}, "location")
    for route in db.query(LocationTravel).filter(
        (LocationTravel.from_location_id == stub.id) | (LocationTravel.to_location_id == stub.id)
    ):
        update(
            route,
            {
                "from_location_id": into.id if route.from_location_id == stub.id else route.from_location_id,
                "to_location_id": into.id if route.to_location_id == stub.id else route.to_location_id,
            },
            "location_travel",
        )
    names = [n for n in [*(into.aliases or []), stub.name, *(stub.aliases or [])] if n and n != into.name]
    update(into, {"aliases": list(dict.fromkeys(names))}, "location")
    db.flush()

    # Captured now, with nothing left under it, so Undo restores just the found place.
    db.expire(stub, ["children"])
    change_log.record(
        db, story_id=story, entity_type="location", entity_id=stub.id, action="delete",
        before=change_log.capture_location(stub, db), after=None, label=label, actor_id=actor,
        client_id=client, batch_id=batch,
    )  # fmt: skip
    db.delete(stub)
    db.commit()
    db.refresh(into)
    return into


def _within(place: Location, ancestor: Location, db: Session) -> bool:
    seen: set[str] = set()
    current: Location | None = place
    while current is not None and current.parent_id and current.parent_id not in seen:
        if current.parent_id == ancestor.id:
            return True
        seen.add(current.parent_id)
        current = db.get(Location, current.parent_id)
    return False
