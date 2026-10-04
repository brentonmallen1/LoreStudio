"""Setups that pay off in another book of the series (v1.5): the gun on the wall in Book 1
that fires in Book 3.

A link always runs from the earlier book to the later one, whichever end it was made from.
Its undo belongs to the book it was made in (undo is per book). A link whose scene is gone
is skipped by every read, and pruned with the series' other dead links (``prune_links``).
Nothing here commits.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ...models.series import Series, SeriesSceneLink
from ...models.structure import StructureNode
from .. import change_log
from .service import SeriesError, positions

#: The scene links' own kinds (routers/scene_links.py): what a setup does for its payoff.
LINK_TYPES = ("foreshadowing", "callback", "parallel", "causes", "contrast", "echoes")


def _scene(db: Session, story_id: str, node_id: str) -> StructureNode:
    node = db.get(StructureNode, node_id)
    if node is None or node.story_id != story_id:
        raise SeriesError("That scene is not in that book.", 404)
    return node


def add_link(
    db: Session,
    series: Series,
    a: tuple[str, str],
    b: tuple[str, str],
    *,
    link_type: str,
    note: str,
    made_in: str,
    actor_id: str | None,
    client_id: str | None,
) -> SeriesSceneLink:
    """A link between a scene of one book and a scene of another, ``a`` and ``b`` each
    ``(story_id, node_id)``, in either order: it is kept earlier book first."""
    pos = positions(series)
    for story_id, node_id in (a, b):
        if story_id not in pos:
            raise SeriesError("That book is not in this series.", 404)
        _scene(db, story_id, node_id)
    if a[0] == b[0]:
        raise SeriesError("Both scenes are in one book: that is a setup of the book's own.")
    if link_type not in LINK_TYPES:
        raise SeriesError(f"A setup is one of: {', '.join(LINK_TYPES)}.")
    if made_in not in (a[0], b[0]):
        raise SeriesError("A setup across books is made from one of its two books.")
    (src, src_node), (dst, dst_node) = sorted((a, b), key=lambda e: pos[e[0]])
    link = SeriesSceneLink(
        source_story_id=src,
        source_node_id=src_node,
        target_story_id=dst,
        target_node_id=dst_node,
        link_type=link_type,
        note=note,
        created_in_story_id=made_in,
    )
    series.scene_links.append(link)
    db.flush()
    change_log.record(
        db,
        story_id=made_in,
        entity_type="series_scene_link",
        entity_id=link.id,
        action="create",
        before=None,
        after={"series_scene_links": [change_log._row(link)]},
        label="Link a setup to another book",
        actor_id=actor_id,
        client_id=client_id,
    )
    return link


def _link(series: Series, link_id: str) -> SeriesSceneLink:
    link = next((x for x in series.scene_links if x.id == link_id), None)
    if link is None:
        raise SeriesError("That setup is not in this series.", 404)
    return link


def update_link(
    db: Session,
    series: Series,
    link_id: str,
    data: dict,
    *,
    actor_id: str | None,
    client_id: str | None,
) -> SeriesSceneLink:
    link = _link(series, link_id)
    if "link_type" in data and data["link_type"] not in LINK_TYPES:
        raise SeriesError(f"A setup is one of: {', '.join(LINK_TYPES)}.")
    change_log.record_update(
        db,
        link,
        data,
        entity_type="series_scene_link",
        story_id=link.created_in_story_id,
        label="Change a setup across books: {fields}",
        actor_id=actor_id,
        client_id=client_id,
    )
    for key, value in data.items():
        setattr(link, key, value)
    db.flush()
    return link


def remove_link(db: Session, series: Series, link_id: str, *, actor_id: str | None, client_id: str | None) -> None:
    link = _link(series, link_id)
    change_log.record_row_delete(
        db,
        link,
        "series_scene_links",
        entity_type="series_scene_link",
        story_id=link.created_in_story_id,
        label="Unlink a setup across books",
        actor_id=actor_id,
        client_id=client_id,
    )
    series.scene_links.remove(link)
    db.delete(link)
    db.flush()


def drop_links_of(db: Session, series: Series, story_id: str) -> None:
    """A book leaving the series takes its links to the other books with it."""
    for link in list(series.scene_links):
        if story_id in (link.source_story_id, link.target_story_id):
            series.scene_links.remove(link)
            db.delete(link)


def live_links(db: Session, series: Series) -> list[SeriesSceneLink]:
    """The links whose two scenes are still where they were. Reads only."""
    ids = {n for link in series.scene_links for n in (link.source_node_id, link.target_node_id)}
    rows = db.query(StructureNode.id, StructureNode.story_id).filter(StructureNode.id.in_(ids)).all() if ids else []
    where: dict[str, str] = {node_id: story_id for node_id, story_id in rows}
    pos = positions(series)
    return [
        link
        for link in series.scene_links
        if where.get(link.source_node_id) == link.source_story_id
        and where.get(link.target_node_id) == link.target_story_id
        and link.source_story_id in pos
        and link.target_story_id in pos
    ]


def prune_links(db: Session, series: Series) -> int:
    """Forget links whose scene was deleted. Series endpoints only: a read must not write."""
    alive = {link.id for link in live_links(db, series)}
    gone = [link for link in series.scene_links if link.id not in alive]
    for link in gone:
        series.scene_links.remove(link)
        db.delete(link)
    db.flush()
    return len(gone)
