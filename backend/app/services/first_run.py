"""
First run (doc 30 D4): a new account is asked, once, whether it wants the Assistant.

How a new account is told from an old one: an account made from now on starts with
`settings.ui.welcome = "ask"`. The app asks its question while that is so, and the answer sets
`ui.mode` and turns `ui.welcome` to "done" in the same save. An account from before this has no
`welcome` key at all, so it is never asked and keeps the mode it has (Studio, for one that never
chose). Nothing is guessed from what an account holds, and no migration has to touch old rows.
"""

WELCOME_ASK = "ask"


def new_account_settings() -> dict:
    """The settings a brand-new account starts with."""
    return {"ui": {"welcome": WELCOME_ASK}}
