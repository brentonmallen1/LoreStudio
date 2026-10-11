"""The example stories: seeded on first start (the demo always, the rest with
SEED_EXTRA_DEMOS=true), and added on request from the dashboard or Settings › Account
(`POST /api/system/examples`).

Each seeder adds its story to the admin account and skips it if a story of that title exists, so
running them again only adds what is missing. Order matters: the sequel carries characters on
from "The Last Lighthouse".
"""

from collections.abc import Callable

from sqlalchemy.orm import Session

from ..config import settings
from ..models.story import Story
from ..models.user import User
from . import seed, seed_screenplay, seed_series, seed_stage_play

#: Seeded on first start when SEED_DEMO is on (the default).
DEMO: list[tuple[str, Callable[[], None]]] = [
    ("The Last Lighthouse", seed.seed_demo_story),
    (seed_screenplay.TITLE, seed_screenplay.seed_screenplay_demo),
    (seed_stage_play.TITLE, seed_stage_play.seed_stage_play_demo),
]

#: Seeded on first start only with SEED_EXTRA_DEMOS; otherwise on request.
EXTRA: list[tuple[str, Callable[[], None]]] = [
    ("The Last Signal", seed.seed_scifi_demo_story),
    ("The Weight of Keys", seed.seed_flash_fiction_demo),
    ("The Audition", seed.seed_short_story_demo),
    ("Sixty Minutes", seed.seed_first_person_demo),
    (seed_series.SEQUEL, seed_series.seed_lighthouse_sequel),
]


def is_examples_account(user: User) -> bool:
    """The examples go to the admin account the app made, so only it can add them."""
    return user.username == settings.admin_username


def missing(db: Session, user: User) -> list[str]:
    """The examples this account does not have (by title: one it renamed counts as missing)."""
    have = {title for (title,) in db.query(Story.title).filter(Story.user_id == user.id)}
    return [title for title, _ in DEMO + EXTRA if title not in have]


def add_missing(db: Session, user: User) -> list[str]:
    """Add every missing example; the titles added, in order."""
    wanted = missing(db, user)
    for title, seeder in DEMO + EXTRA:
        if title in wanted:
            seeder()  # in its own session: what it adds is committed when it returns
    db.expire_all()
    still = set(missing(db, user))
    return [title for title in wanted if title not in still]
