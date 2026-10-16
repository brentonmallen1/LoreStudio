"""
The Lighthouse's scene takes (doc 29 D7): "Knock at the Door" has a second take, "Calder speaks
first", where the Visitor speaks before the door is open. The first take, the one written first,
still counts, so the manuscript, its checks and every other sample reading stay as they were;
the switcher in the scene's header, Compare and Use this take have something to show.
"""

from sqlalchemy.orm import Session

from ..models.scene_take import SceneTake
from ..models.structure import StructureNode
from .takes import FIRST_LABEL
from .word_count import count_words

#: The passage the second take reworks, as the first take has it.
_MEETING = (
    "<p>The person on the other side of the door was not what she had expected. She had expected a fisherman,"
    " perhaps, or someone's stray nephew caught in the weather. What she got was a woman of about fifty,"
    " grey-haired, wearing a canvas jacket that was soaked through and carrying a bag over one shoulder as if"
    " she'd simply stepped off a bus in light drizzle.</p>"
)
_NAMED = "<p>“You’re Eleanor Vance,” the visitor said, as if confirming a fact.</p>"

#: The same passage in take 2: she speaks first, before the door is fully open.
_SPEAKS_FIRST = (
    "<p>“You’re Eleanor Vance,” the woman said before the door was fully open, as if Eleanor had been"
    " expected to answer and was late.</p>"
    "<p>She was not what Eleanor had expected. Not a fisherman, not someone's stray nephew caught in the"
    " weather, but a woman of about fifty, grey-haired, in a canvas jacket soaked through, a bag over one"
    " shoulder as if she'd simply stepped off a bus in light drizzle.</p>"
)


def seed_knock_takes(db: Session, scene: StructureNode) -> None:
    """Take 1 (first draft, the one that counts, open) and take 2 (Calder speaks first)."""
    prose = scene.content or ""
    if _MEETING not in prose or _NAMED not in prose:
        return
    second = prose.replace(_NAMED, "").replace(_MEETING, _SPEAKS_FIRST)
    db.add_all(
        [
            SceneTake(
                node_id=scene.id,
                label=FIRST_LABEL,
                position=0,
                counts=True,
                is_open=True,
                word_count=count_words(prose),
            ),
            SceneTake(
                node_id=scene.id,
                label="Calder speaks first",
                position=1,
                content=second,
                word_count=count_words(second),
            ),
        ]
    )
