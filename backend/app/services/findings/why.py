"""Why a finding can matter, and what to try (doc 30 D5).

One entry per check that runs without the model: the prose checks, the checks over the story's
own records (threads, chapters, the cast, the target) and the series checks. The words are plain
and short and never a rule: each says why a reader might trip, and offers something to try that
the writer is free to ignore. The Assistant's findings explain themselves in their own words.
"""

from __future__ import annotations

#: check -> (why it can matter, what to try)
WHY: dict[str, tuple[str, str]] = {
    # ── Prose, read here ──
    "name_drift": (
        "A name spelled two ways reads as two people, and readers catch the slip before anything else.",
        "If it's a slip, change it here. If it's someone new, add them to the Lorebook so the check knows them.",
    ),
    "unknown_speaker": (
        "Someone who speaks but isn't in the Lorebook can't be followed: their lines and scenes go uncounted.",
        "Add them as a character if they matter to the story, or leave them as a walk-on.",
    ),
    "second_heading": (
        "A script scene is one place and one time. A second heading inside it starts a scene the outline "
        "doesn't know about.",
        "Split it into a scene of its own, or keep it as a line if it isn't really a new place.",
    ),
    "passive_voice": (
        "Passive sentences hide who does what, and a run of them can make a scene feel distant.",
        "Read the flagged sentences aloud. Where the doer matters, put them first; keep the ones where they don't.",
    ),
    "adverb_overuse": (
        "An adverb often props up a verb that could do the work alone, and many together soften the prose.",
        "Look for a stronger verb, or let the action show how it's done. Keep the adverbs that earn their place.",
    ),
    "said_bookisms": (
        "Words like “hissed”, “exclaimed” and “retorted” pull the eye to the tag instead of the line. "
        "“Said” almost disappears, so the dialogue carries the feeling.",
        "Swap a few for “said”, or drop the tag where it's clear who is talking. Keep the ones that do real work.",
    ),
    "repeated_words": (
        "The same word close together catches the reader's ear, like an echo you didn't mean.",
        "Change one of them, or recast the sentence. A repeat kept for rhythm or emphasis can stay.",
    ),
    "sentence_variety": (
        "When every sentence runs to about the same length, the prose settles into one beat and attention drifts.",
        "Break a long sentence in two, or join two short ones. A short line after long ones lands harder.",
    ),
    "past_in_action": (
        "Script action is what we see as it happens. The past tense reads like a novel and slows the page.",
        "Put the action in the present: “She opens the door”, not “opened”.",
    ),
    "tense_shift": (
        "A slip out of the scene's tense can make the reader stumble over when things happen.",
        "Check each flagged sentence. A memory or a flashback may be on purpose; the rest can match the scene.",
    ),
    "pov_drift": (
        "When a scene shows another character's thoughts, the reader loses the one head they were riding in.",
        "Show what the other character does or says instead of what they think, or change the point of view "
        "on purpose, at a break.",
    ),
    # ── The story's shape: threads, chapters, the cast ──
    "absent_character": (
        "Someone who matters and drops out of sight can fade from the reader's mind by the time they return.",
        "Give them a mention, a line, or a thought from someone else. If the absence is the point, say so.",
    ),
    "mice_nesting": (
        "Threads usually close in the reverse order they opened, so the biggest question is answered last. "
        "Crossing them can make an ending feel jumbled.",
        "See whether the thread that opened last can close first. If the crossing is deliberate, mark it on purpose.",
    ),
    "thin_try_fail": (
        "A thread with no attempts and setbacks can read as if it solves itself. Readers believe what "
        "characters work for.",
        "Give someone a try that goes wrong, or costs them, in one of its scenes.",
    ),
    "held_prose": (
        "Words kept on a chapter instead of in a scene don't show on the strip, in the export or in Numbers.",
        "Give that prose a scene of its own. Undo takes it back if you change your mind.",
    ),
    "empty_chapter": (
        "A chapter with no words and no plan is a gap in the story's shape, easy to forget while you write around it.",
        "Write a line of plan for it, or remove it if the story no longer needs it.",
    ),
    "word_target": (
        "Each form has a usual length, and readers and agents notice when a book runs well past it.",
        "Decide whether it's still the form you mean. Change it in Story identity, or look for what could go.",
    ),
    "trope_thread_set_aside": (
        "A trope rides on its thread. With the thread set aside, nothing in the story carries it.",
        "Set the trope aside too, or move it to the thread that carries it now.",
    ),
    "trope_never_turns": (
        "You meant to turn this trope, but nothing on its thread records the turn, so the reader may get "
        "the version they expect.",
        "Mark the scene that turns it on the thread, or plan that scene.",
    ),
    "quiet_thread": (
        "A thread left untouched for a long stretch can slip from the reader's mind.",
        "Touch it in a scene in between: a mention, a reminder, one small step.",
    ),
    "closes_before_opens": (
        "A thread that ends before it begins usually means a scene is marked wrong, or the scenes are out of order.",
        "Check which scenes open and close it, on the thread's sheet.",
    ),
    "clue_after_reveal": (
        "A clue that comes after its twist is revealed can't prepare the reader for it.",
        "Move the clue earlier, or keep it as an echo rather than a clue.",
    ),
    "reveal_without_clue": (
        "A twist with nothing pointing to it can feel like a cheat. The best ones surprise and, looking "
        "back, play fair.",
        "Plant a clue or two before the reveal, even small ones.",
    ),
    "misdirection_unanswered": (
        "Leading the reader astray makes a promise. Without the reveal, the misdirection just looks like a mistake.",
        "Plan the scene that reveals the truth, or let the misdirection go.",
    ),
    "shared_reveal": (
        "Several twists revealed at once can blur together and blunt each other.",
        "Move one or two to other scenes, so each gets its own moment.",
    ),
    # ── Across the books of a series ──
    "series-canon": (
        "Something meant to stay true across the series says one thing here and another in another book.",
        "Decide which is right, then use it everywhere or change it here.",
    ),
    "series-axis-missing": (
        "The series plan builds this book around someone who isn't in it yet.",
        "Bring them into this book, or change the plan.",
    ),
    "series-axis-pov": (
        "The series plans this book through one character's eyes, but here someone else is telling it.",
        "Change the plan or the point of view. An interlude told by someone else on purpose can stay.",
    ),
    "series-axis-era": (
        "This scene is set outside the time the series plans for this book.",
        "Keep it as a flashback, or move it to the book whose time it belongs to.",
    ),
    "series-left-open": (
        "A thread still open at the end of a book is a promise to the reader. If no later book picks it up, "
        "it's never kept.",
        "Carry it into the next book, close it here, or set it aside.",
    ),
    "series-opens-again": (
        "The reader already holds this question from an earlier book, so opening it again can feel like a repeat.",
        "Let this scene move the question forward rather than raise it anew.",
    ),
    "series-nesting": (
        "Across the books, threads usually close in the reverse order they opened. Crossing them can muddle an ending.",
        "See whether the later thread can close first, or mark the crossing on purpose.",
    ),
}


def explain(check: str) -> dict[str, str]:
    """The finding's `why` and `what_to_try`, or nothing for a check without them (the
    Assistant's, which say why in their own words)."""
    hit = WHY.get(check)
    return {"why": hit[0], "what_to_try": hit[1]} if hit else {}
