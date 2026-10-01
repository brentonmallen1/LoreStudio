"""The story as every check reads it: loaded once per request (doc 12 P3).

Scenes are the leaves of the structure tree in reading order, the same order the strip
and the frontend's ``sceneLeaves`` use. Assistant results name scenes by title, so the
view also resolves a title (or a sentence that quotes one) back to its scene.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import cached_property

from sqlalchemy.orm import Session

from ...models.character import Character
from ...models.plot_thread import PlotThread
from ...models.story import Story
from ...models.structure import StoryStructureTemplate, StructureNode
from ...schemas.findings import FindingsSizing
from ..text_utils import html_to_text
from ..word_count import get_word_count_status
from .fingerprint import normalise

_PUNCT = re.compile(r"[\"'“”‘’.,:;!?()\[\]]")


def _title_key(title: str) -> str:
    return _PUNCT.sub("", normalise(title)).strip()


@dataclass
class StoryView:
    story: Story
    nodes: list[StructureNode]
    characters: list[Character]
    threads: list[PlotThread]
    template: StoryStructureTemplate | None = None
    _text: dict[str, str] = field(default_factory=dict)

    @cached_property
    def by_id(self) -> dict[str, StructureNode]:
        return {n.id: n for n in self.nodes}

    @cached_property
    def children(self) -> dict[str | None, list[StructureNode]]:
        out: dict[str | None, list[StructureNode]] = {}
        for n in self.nodes:
            out.setdefault(n.parent_id, []).append(n)
        for kids in out.values():
            kids.sort(key=lambda n: n.position)
        return out

    @cached_property
    def ordered(self) -> list[StructureNode]:
        """Every node, depth first in reading order."""
        out: list[StructureNode] = []

        def walk(parent: str | None) -> None:
            for n in self.children.get(parent, []):
                out.append(n)
                walk(n.id)

        walk(None)
        return out

    @cached_property
    def leaves(self) -> list[StructureNode]:
        return [n for n in self.ordered if not self.children.get(n.id)]

    @cached_property
    def written(self) -> list[StructureNode]:
        return [n for n in self.leaves if (n.content or "").strip()]

    @cached_property
    def chapters(self) -> list[StructureNode]:
        return [n for n in self.ordered if (n.level_type or "").lower() == "chapter"]

    def leaves_under(self, node: StructureNode) -> list[StructureNode]:
        kids = self.children.get(node.id, [])
        if not kids:
            return [node]
        return [leaf for k in kids for leaf in self.leaves_under(k)]

    def text(self, node: StructureNode) -> str:
        if node.id not in self._text:
            self._text[node.id] = html_to_text(node.content or "")
        return self._text[node.id]

    @cached_property
    def _titles(self) -> list[tuple[str, StructureNode]]:
        pairs = [(_title_key(n.title or ""), n) for n in self.leaves if (n.title or "").strip()]
        return sorted(pairs, key=lambda p: len(p[0]), reverse=True)

    def scene_named(self, ref: str) -> StructureNode | None:
        """A scene from a title an Assistant wrote: exact first, then one quoted inside."""
        key = _title_key(ref)
        if not key:
            return None
        for title, node in self._titles:
            if title == key:
                return node
        for title, node in self._titles:
            if len(title) >= 4 and re.search(rf"(?<!\w){re.escape(title)}(?!\w)", key):
                return node
        return None

    def still_there(self, node: StructureNode | None, passage: str) -> bool:
        """Is a quoted passage still in the scene? A finding about text the author has
        since rewritten is answered; it leaves the feed without a dismissal."""
        if node is None or not passage.strip():
            return True
        needle = normalise(passage).strip(" .…")[:80]
        return not needle or needle in normalise(self.text(node))

    @cached_property
    def sizing(self) -> FindingsSizing:
        levels = [str(lv.get("name", "")).lower() for lv in (self.template.levels if self.template else [])]
        total = sum(n.word_count or 0 for n in self.leaves)
        return FindingsSizing(
            has_chapters="chapter" in levels or bool(self.chapters),
            has_target=get_word_count_status(self.story.intended_length or "", total) is not None,
            written_scenes=len(self.written),
        )


def load_view(story: Story, db: Session) -> StoryView:
    return StoryView(
        story=story,
        nodes=db.query(StructureNode).filter(StructureNode.story_id == story.id).all(),
        characters=db.query(Character).filter(Character.story_id == story.id).all(),
        threads=db.query(PlotThread).filter(PlotThread.story_id == story.id).all(),
        template=db.get(StoryStructureTemplate, story.structure_template_id),
    )
