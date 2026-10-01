"""Small helpers for words the author reads in the Chronicle (doc 13 P7)."""


def count(n: int, one: str, many: str | None = None) -> str:
    """ "1 scene", "3 scenes"; never "3 scene(s)"."""
    return f"{n} {one if n == 1 else (many or one + 's')}"
