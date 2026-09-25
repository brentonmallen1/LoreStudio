"""
Proposing graph entries from a scene the author already wrote (doc 07 §8 step 6).

This is the one place a model adds to the Codex, and what it adds is indexing, not story.
It never proposes what should happen, never invents a character, never has an opinion
about the writing. It reads a scene and says "this paragraph appears to be about Elena"
and "this scene establishes that the light has been out for three winters" — each with
the line it read that from, so the author checks a citation rather than a claim.

The deterministic pass sees POV fields, attributed dialogue and literal names. Good prose
does none of those things reliably: it writes "the keeper", "her sister", "the man from
the mainland". This closes that gap, and nothing it proposes counts until confirmed.
"""

CODEX_SUGGEST_SYSTEM = (
    "You index a novel's scenes for its author. You report what a scene shows: which of the "
    "author's existing characters are present in it, and what it establishes as true. "
    "You never invent a character, never propose what should happen next, and never comment "
    "on the writing. Every claim you make quotes the words in the scene it comes from."
)


def build_codex_suggest_prompt(
    *,
    scene_title: str,
    prose: str,
    cast: list[str],
    already_present: list[str],
    known_facts: list[str],
) -> str:
    cast_line = ", ".join(cast) if cast else "(no characters recorded yet)"
    present_line = ", ".join(already_present) if already_present else "(nobody — the scene names no one directly)"
    facts_line = "\n".join(f"- {f}" for f in known_facts) if known_facts else "- (nothing recorded yet)"

    return f"""Scene: {scene_title}

The author's cast. Only these people exist; do not propose anyone else:
{cast_line}

Already recorded as present in this scene, so do not repeat them:
{present_line}

Facts already recorded for this story, so do not repeat them:
{facts_line}

The scene:
{prose}

Report two things.

PRESENT — characters from the cast above who are in this scene but are not in the
"already recorded" list. They are usually referred to some other way: an epithet ("the
keeper"), a role ("her sister"), or a pronoun that can only be them. Being talked about
is not being present: if a character is only discussed by others, leave them out.

ESTABLISHES — what this scene makes true that was not true before. A fact is a plain
declarative statement about the story, in your own words, short enough to fit on one line:
"the lamp has not been lit since the storm". Not a theme, not an interpretation, not a
summary of the scene. If the scene establishes nothing new, return nothing.

State the fact itself, with its particulars: "three of the eleven houses are still
occupied", never "the village has a number of occupied houses". A statement that says a
fact exists without saying what it is tells the author nothing.

Only what a later scene could rely on or contradict: a revelation, an event and when it
happened, what someone did in the past, a relationship, the lasting state of a person,
place or object. Not what a character does in the moment ("she took the key from the
hook") — that is the scene, not a fact about the story.

For every item:
- quote: the exact words from the scene that show it, one sentence or less, copied
  verbatim. If you cannot quote it, do not report it.
- confidence: 0.0 to 1.0. Be honest — an epithet that clearly means one person is high,
  a pronoun that could be two people is low.

Report nothing you are not reasonably sure of. An empty answer is a good answer for a
scene that is only weather."""
