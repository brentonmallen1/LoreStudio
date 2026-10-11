"""
The script versions of the analysis prompts (doc 25, P7): the same questions asked of a
screenplay, in its own terms. Kept apart from analysis.py (size budget).

A prompt written for prose is reworded phrase by phrase (`for_script`), so the prose prompt
stays the one source. Unfilmables, show-don't-tell for the screen, is its own prompt, in
show_dont_tell.py.
"""

from .core import for_script

#: What a script adds to the clichés a reader knows (doc 25, P7).
SCREEN_CLICHES = """FOR A SCREENPLAY, also look at: dialogue heard in a thousand films ("We've got company.", "Is that all you've got?", "We need to talk."), stock action and camera habits ("A single tear rolls down her cheek.", "We see…" on every line), and screen set pieces played straight (the villain's monologue, the ticking bomb, the slow clap). A character's line can be a cliché they would say; say so in intentional_use_case."""


def economy(prompt: str) -> str:
    return for_script(
        prompt,
        {
            "You are a short fiction editor": "You are a script editor",
            "from a short fiction perspective": "for a script of its length, where every page is a minute of screen time",
        },
    )


def pacing(prompt: str, total_words: int, pages: int) -> str:
    return for_script(
        prompt,
        {
            f"Total words written: {total_words:,}": f"Length: {pages} pages, about a minute of screen time each",
            "how word count is distributed": "how the pages are distributed",
            "and word counts": "and lengths in eighths of a page (a scene over three pages runs long on screen)",
        },
    )


def first_pass(prompt: str, total_words: int, pages: int) -> str:
    return for_script(prompt, {f"TOTAL WORDS: {total_words:,}": f"LENGTH: {pages} pages"})


def cliche_analysis(prompt: str, total_words: int, pages: int) -> str:
    return for_script(
        prompt,
        {
            "analyzing prose from": "reading the screenplay",
            f"Approximate word count: {total_words:,}": f"Length: about {pages} pages",
            "IMPORTANT: Genre": SCREEN_CLICHES + "\n\nIMPORTANT: Genre",
            "PROSE TO ANALYZE:": "THE SCRIPT (Fountain):",
            "X clichés per 1000 words": "X clichés per ten pages",
        },
    )


def cliche_coach(prompt: str) -> str:
    return for_script(
        prompt,
        {
            "from their work-in-progress": "from their screenplay",
            "don't write the prose for them": "don't write the script's lines for them",
            "IMPORTANT PRINCIPLES:": SCREEN_CLICHES + "\n\nIMPORTANT PRINCIPLES:",
        },
    )
