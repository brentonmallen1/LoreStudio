"""The sample stories (doc 26, P7): "Sample: Kind · Title", loaded on request into the account
that asks (Guides › Getting started, Settings › Account, the empty dashboard, `POST
/api/system/examples`). A fresh install holds only the tutorials; SEED_DEMO=true also loads
`DEMO` into the admin account on first start (development, the QA copy).

Each seeder adds its sample to one account and skips it if that account has it, under its new
title or the one it had before the samples were named, so running them again only adds what is
missing. Order matters: the screenplay is told from the novel, and the sequel carries characters
on from it.
"""

from collections.abc import Callable

from sqlalchemy.orm import Session

from ..models.story import Story
from ..models.user import User
from . import sample_titles, seed, seed_screenplay, seed_series, seed_stage_play

Seeder = Callable[[str | None], None]

#: The Lighthouse in its three forms: SEED_DEMO's first start.
DEMO: list[tuple[str, Seeder]] = [
    (sample_titles.NOVEL, seed.seed_demo_story),
    (sample_titles.SCREENPLAY, seed_screenplay.seed_screenplay_demo),
    (sample_titles.STAGE_PLAY, seed_stage_play.seed_stage_play_demo),
]

#: The rest; SEED_EXTRA_DEMOS loads them on first start too.
EXTRA: list[tuple[str, Seeder]] = [
    (sample_titles.SCIFI, seed.seed_scifi_demo_story),
    (sample_titles.FLASH, seed.seed_flash_fiction_demo),
    (sample_titles.SHORT, seed.seed_short_story_demo),
    (sample_titles.FIRST_PERSON, seed.seed_first_person_demo),
    (sample_titles.SERIES, seed_series.seed_lighthouse_sequel),
]

#: Every title a sample has had, for telling them from the writer's own stories.
SAMPLE_TITLES = sample_titles.ALL


def missing(db: Session, user: User) -> list[str]:
    """The samples this account does not have (by title: one it renamed counts as missing)."""
    have = {title for (title,) in db.query(Story.title).filter(Story.user_id == user.id)}
    return [title for title, _ in DEMO + EXTRA if title not in have and sample_titles.OLD[title] not in have]


def add_missing(db: Session, user: User) -> list[str]:
    """Add every missing sample to this account; the titles added, in order."""
    wanted = missing(db, user)
    for title, seeder in DEMO + EXTRA:
        if title in wanted:
            seeder(user.id)  # in its own session: what it adds is committed when it returns
    db.expire_all()
    still = set(missing(db, user))
    return [title for title in wanted if title not in still]
