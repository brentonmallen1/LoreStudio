"""What a scene does to a thread (doc 18 C1): one list of scenes per thread, each with a role.

Where a thread opens and closes and every try along the way used to be three separate
fields; now they are roles on the thread's scenes, and its status follows from them.
"""

ROLE_LABELS: dict[str, str] = {
    "opens": "opens it",
    "moves": "moves it on",
    "turns": "turns it",
    "complicates": "complicates it",
    "fails": "a try fails",
    "fails_worse": "a try fails and makes things worse",
    "costs": "a try succeeds, at a cost",
    "succeeds": "a try succeeds",
    "closes": "closes it",
}

#: The roles that are a try and how it goes (Sanderson's try/fail cycles).
TRY_ROLES = frozenset({"fails", "fails_worse", "costs", "succeeds"})


def role_label(role: str | None) -> str:
    return ROLE_LABELS.get(role or "", role or "")


def tries(thread) -> list:
    """The thread's appearances that are a try."""
    return [a for a in thread.appearances if a.role in TRY_ROLES]
