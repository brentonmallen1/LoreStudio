"""Proposals: what the app noticed and the author has not decided (doc 12 P5).

The other half of the findings feed. A finding says "look at this"; a proposal says "this
could go in the Lorebook" and offers to put it there. Gathered on every read from where
each kind already lives; its id names the source and the row (``stub:<location id>``).
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

ProposalKind = Literal["place", "person", "dialogue", "fact", "presence", "relationship"]
ProposalSource = Literal["local", "ai"]


class ProposalAction(BaseModel):
    id: str
    label: str
    primary: bool = False


class Proposal(BaseModel):
    id: str
    kind: ProposalKind
    source: ProposalSource
    text: str
    #: The name or thing proposed, on its own ("Gull"), for a "yes" that creates it.
    subject: str = ""
    #: The words in the prose it came from: the author checks a quote, not a claim.
    evidence: str = ""
    node_id: str | None = None
    where: str = ""
    actions: list[ProposalAction]
    #: The label for "no": what declining does differs by source (delete a stub, forget a name).
    decline: str = "Not this"
    created_at: datetime | None = None


class ProposalsOut(BaseModel):
    proposals: list[Proposal]
    counts_by_kind: dict[str, int]
    count: int
    #: When the local name scan last ran: "Look again" says how stale the names are.
    last_scan: datetime | None = None


class ProposalsCount(BaseModel):
    count: int


class ActRequest(BaseModel):
    action: str


class ActResult(BaseModel):
    #: What the action made or changed, for the page to link to.
    entity_type: str | None = None
    entity_id: str | None = None
    #: An action that is the author's to do: open the tagging for this scene.
    open: str | None = None
