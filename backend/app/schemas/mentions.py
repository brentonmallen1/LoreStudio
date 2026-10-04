"""
What the author @-mentioned in a chat composer (doc 11 P6).

A mention *adds* something to the context a feature assembles on its own; it never
replaces the automatic selection. The client sends kind and id; the server looks the
thing up, ignores anything it cannot find in this story, and says in the transparency
view that it was there because the author asked.
"""

from typing import Literal

from pydantic import BaseModel

MentionKind = Literal["character", "location", "scene", "thread", "twist"]


class MentionedRef(BaseModel):
    kind: MentionKind
    id: str
