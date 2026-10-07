"""
Who are they (doc 20 P8): how a character's identity, body and mind, the way they take things
and what formed them reach a prompt.

One place says it for every feature, so the interview, the group interview, the scene features
and the continuity check describe a person the same way, and leave out the same things: an entry
the author switched out of the Assistant, content notes (for the author only), and what the
character doesn't know about themselves (Needs).

Every block written here carries ``MARKER``. The gateway appends ``CARE_RULES`` to any call
whose prompt carries it, as it appends a feature's class contract, so no feature can send these
fields without the rules that go with them.
"""

from __future__ import annotations

from typing import Any

from ....schemas.who_they_are import AREAS

#: In every block of these fields; the gateway looks for it (services/llm/gateway.py).
MARKER = "(in the author's words)"

CARE_RULES = """— Writing about who a person is —
- Describe a character's body, health, identity or history only as the author wrote it. Do not add causes, symptoms, diagnoses or events the author did not write.
- Never invent a disability, illness, trauma or identity for a character, and never offer one as a way to add depth.
- Do not steer toward stock patterns: disability as tragedy or a thing to be cured; a disabled character who exists to inspire or to teach someone else a lesson; a queer or trans character whose identity is the whole plot, or who dies to move someone else's story; trauma as the explanation for cruelty; mental illness as danger. If the author asks for analysis and their pages come near one, say so plainly as an observation; otherwise leave it.
- Use the author's words for the character (identity-first or person-first as written) and their pronouns.
- Refer to hard experiences without graphic detail; never elaborate violence, abuse or self-harm."""

#: How the persona holds these things (P8): they colour the answers, they are not the topic.
PERSONA_NOTE = (
    "These are part of your life, not the subject of the conversation. They shape how you hear a "
    "question, what you'd rather not say, what stings. Speak of them the way people do: when it's "
    "relevant, in your own words, sometimes not at all, without explaining yourself for an "
    "audience. If something hard is asked about directly, answer as you would to someone you "
    "trust this much."
)

_AREA_WORDS = {
    "moving": "moving",
    "senses": "senses",
    "communicating": "communicating",
    "health": "long-term health and pain",
    "neurodivergence": "neurodivergence",
    "mental_health": "mental health",
    "other": "",
}
assert set(_AREA_WORDS) == set(AREAS)

_IDENTITY = (
    ("gender", "gender"),
    ("presentation", "presents as"),
    ("sex", "sex"),
    ("age", "age"),
    ("orientation", "orientation"),
    ("languages", "languages"),
    ("heritage", "heritage"),
    ("faith", "faith"),
    ("family", "family"),
    ("circumstances", "money and class"),
)
_TAKES = (
    ("sore_spots", "what gets under your skin"),
    ("takes_personally", "how personally you take things"),
    ("shows_hurt", "how it shows when you're hurt"),
    ("copes", "how you cope"),
    ("holds_on", "how long you hold on"),
)


def _text(value: Any) -> str:
    return str(value or "").strip()


def entries(character: Any, column: str) -> list[dict]:
    """The entries the Assistant may use: written ones, minus any the author switched out."""
    return [
        e
        for e in (getattr(character, column, None) or [])
        if e.get("assistant", True) and (_text(e.get("name")) or _text(e.get("title")))
    ]


def _facet_line(e: dict, *, fields: tuple[tuple[str, str], ...]) -> str:
    area = _AREA_WORDS.get(e.get("area", ""), "")
    head = f"{_text(e.get('name'))}" + (f" ({area})" if area else "")
    parts = [f"{label}: {_text(e.get(key))}" for key, label in fields if _text(e.get(key))]
    return "; ".join([head, *parts])


def _formative_line(e: dict, *, fields: tuple[tuple[str, str], ...]) -> str:
    head = _text(e.get("title")) + (" (the wound behind your arc)" if e.get("wound") else "")
    parts = [f"{label}: {_text(e.get(key))}" for key, label in fields if _text(e.get(key))]
    return "; ".join([head, *parts])


_FACET_PERSONA = (
    ("since", "since"),
    ("days", "how it shapes your days"),
    ("impact", "what it does to you"),
    ("page", "how it shows"),
    ("understood", "what you'd want understood"),
)
_FORMATIVE_PERSONA = (
    ("when", "when"),
    ("what", "what happened"),
    ("impact", "what it did to you"),
    ("page", "how it shows"),
)


def persona_lines(character: Any) -> list[str]:
    """Who they are, for the character's own voice (the interview and the group interview)."""
    lines: list[str] = []
    identity = [
        f"{label}: {_text(getattr(character, key, ''))}"
        for key, label in _IDENTITY
        if _text(getattr(character, key, ""))
    ]
    if identity:
        lines.append(f"\nWho you are {MARKER}: " + "; ".join(identity))
    if thinking := _text(getattr(character, "thinking", "")):
        lines.append(f"\nHow you think: {thinking}")
    takes = [
        f"{label}: {_text(getattr(character, key, ''))}" for key, label in _TAKES if _text(getattr(character, key, ""))
    ]
    if takes:
        lines.append(f"\nHow you take things {MARKER}:\n" + "\n".join(f"  - {t}" for t in takes))
    # Believes is their conviction, said as theirs; Needs is what they don't know, so never here.
    if lie := _text(getattr(character, "lie", "")):
        lines.append(f"\nWhat you believe, and are sure of: {lie}")
    if stakes := _text(getattr(character, "stakes", "")):
        lines.append(f"\nWhat you fear losing if you fail: {stakes}")
    facets = entries(character, "facets")
    if facets:
        body = "\n".join(f"  - {_facet_line(e, fields=_FACET_PERSONA)}" for e in facets)
        lines.append(f"\nYour body and mind {MARKER}:\n{body}")
    formed = entries(character, "formative")
    if formed:
        body = "\n".join(f"  - {_formative_line(e, fields=_FORMATIVE_PERSONA)}" for e in formed)
        lines.append(f"\nWhat formed you {MARKER}:\n{body}")
    if facets or formed or takes:
        lines.append(f"\n{PERSONA_NOTE}")
    return lines


def knows(speaker_id: str, entry: dict) -> bool:
    """Whether a character knows another's entry: everyone does, or they are named as knowing."""
    return entry.get("known", "everyone") == "everyone" or speaker_id in (entry.get("known_to") or [])


def about_other(speaker_id: str, other: Any) -> str:
    """Another person in the room, as the speaker sees them: how they present, and what they know."""
    seen = [
        _facet_line(e, fields=(("page", "how it shows"),)) for e in entries(other, "facets") if knows(speaker_id, e)
    ]
    seen += [_text(e.get("title")) for e in entries(other, "formative") if knows(speaker_id, e)]
    parts = []
    if presents := _text(getattr(other, "presentation", "")):
        parts.append(f"presents as {presents}")
    if seen:
        parts.append(f"what you know of them {MARKER}: " + "; ".join(seen))
    return "; ".join(parts)


def packet_profile(character: Any) -> dict:
    """For the scene features' packet (characters on the page): what shows, what stings."""
    out: dict = {}
    for key in ("gender", "pronouns"):
        if value := _text(getattr(character, key, "")):
            out[key] = value
    if shown := [_facet_line(e, fields=(("page", "on the page"),)) for e in entries(character, "facets")]:
        out["body_and_mind"] = shown
    for key in ("sore_spots", "shows_hurt"):
        if value := _text(getattr(character, key, "")):
            out[key] = value
    # A formative experience's title and what it did, never what happened.
    if formed := [_formative_line(e, fields=(("impact", "what it did"),)) for e in entries(character, "formative")]:
        out["formed_by"] = formed
    return out


_PACKET_LABELS = (
    ("gender", "Gender"),
    ("pronouns", "Pronouns"),
    ("sore_spots", "Gets under their skin"),
    ("shows_hurt", "How hurt shows"),
)


def render_packet_profile(c: dict) -> list[str]:
    """A character's packet_profile as lines, for the prompts that print the packet."""
    lines = [f"{label}: {c[key]}" for key, label in _PACKET_LABELS if c.get(key)]
    if c.get("body_and_mind"):
        lines.append(f"Body and mind {MARKER}: " + " | ".join(c["body_and_mind"]))
    if c.get("formed_by"):
        lines.append(f"Formed by {MARKER}: " + " | ".join(c["formed_by"]))
    return lines


def continuity_profile(character: Any) -> str:
    """For the continuity check: what a scene must stay true to (pronouns, how a body shows)."""
    parts = [
        f"{label}: {_text(getattr(character, key, ''))}"
        for key, label in (("gender", "gender"), ("pronouns", "pronouns"))
        if _text(getattr(character, key, ""))
    ]
    parts += [_facet_line(e, fields=(("page", "on the page"),)) for e in entries(character, "facets")]
    return f" Who they are {MARKER}: " + "; ".join(parts) if parts else ""
