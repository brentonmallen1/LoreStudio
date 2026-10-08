"""Every route that changes a story records the change, or says here why it does not (doc 23 P5).

Undo used to be honour-system: a route recorded its change in the change log or it did not,
and nothing noticed. This walks every POST/PUT/PATCH/DELETE route the app serves and reads
its endpoint: a route records when the endpoint, or a function of the app it calls (a few
calls deep), calls one of the change-log writers. Every route that does not is listed in
``NOT_UNDOABLE`` under the reason it is out of the story's undo history.

A new route fails here until it is one or the other. A listed route that starts recording,
or goes away, fails too, so the list never claims more than is true.
"""

from __future__ import annotations

import ast
import importlib
import inspect
import textwrap
from collections.abc import Callable, Iterator

from fastapi.routing import APIRoute

from app.main import app
from app.services import change_log

#: The change-log writers. Anything that calls one of these is undoable.
RECORDERS = (
    change_log.record,
    change_log.record_update,
    change_log.record_row_create,
    change_log.record_row_delete,
    change_log.rewrite_prose,
    change_log.prose_writer,
)

#: How many calls deep to follow an endpoint into the app's own functions.
MAX_DEPTH = 4

MUTATING = frozenset({"POST", "PUT", "PATCH", "DELETE"})

AI_CALLS = (
    # A one-shot Assistant call or analysis. What the model says is logged in the Chronicle
    # (or cached as derived text, like a summary); nothing goes into the story until the
    # author keeps it, through a route that records.
    "DELETE /api/ai/payloads",
    "POST /api/characters/{character_id}/analyze-arc",
    "POST /api/characters/{character_id}/analyze-voice-fidelity",
    "POST /api/characters/{character_id}/assess-dimensionality",
    "POST /api/characters/{character_id}/generate-attributes",
    "POST /api/characters/{character_id}/journey/refresh",
    "POST /api/characters/{character_id}/review/careful",
    "POST /api/media/{asset_id}/analyze",
    "POST /api/media/{asset_id}/analyze/character",
    "POST /api/outlines/{outline_id}/analyze-alignment",
    "POST /api/scenes/{scene_id}/dialogue/ai-suggest",
    "POST /api/stories/{story_id}/analyze/audience-adherence",
    "POST /api/stories/{story_id}/analyze/character-dimensionality",
    "POST /api/stories/{story_id}/analyze/cliches",
    "POST /api/stories/{story_id}/analyze/continuity",
    "POST /api/stories/{story_id}/analyze/economy",
    "POST /api/stories/{story_id}/analyze/editorial-consistency",
    "POST /api/stories/{story_id}/analyze/entity-suggestions",
    "POST /api/stories/{story_id}/analyze/essential-questions",
    "POST /api/stories/{story_id}/analyze/first-pass",
    "POST /api/stories/{story_id}/analyze/pacing",
    "POST /api/stories/{story_id}/analyze/plot-holes",
    "POST /api/stories/{story_id}/analyze/prose-nlp",
    "POST /api/stories/{story_id}/analyze/scene-atmosphere",
    "POST /api/stories/{story_id}/analyze/show-dont-tell",
    "POST /api/stories/{story_id}/analyze/themes",
    "POST /api/stories/{story_id}/brainstorm",
    "POST /api/stories/{story_id}/chat/book-description",
    "POST /api/stories/{story_id}/chat/cliche-coach",
    "POST /api/stories/{story_id}/chat/query-letter",
    "POST /api/stories/{story_id}/discover",
    "POST /api/stories/{story_id}/discovery-questions",
    "POST /api/stories/{story_id}/editorial/run",
    "POST /api/stories/{story_id}/identity-workshop",
    "POST /api/stories/{story_id}/numbers/talk/subjects",
    "POST /api/stories/{story_id}/outlines/extract-from-prose",
    "POST /api/stories/{story_id}/publication/comp-titles",
    "POST /api/stories/{story_id}/reader-knowledge/scan",
    "POST /api/stories/{story_id}/recap",
    "POST /api/stories/{story_id}/scene-plan",
    "POST /api/stories/{story_id}/snowflake/guidance",
    "POST /api/stories/{story_id}/suggest-relationships",
    "POST /api/stories/{story_id}/summarize",
    "POST /api/stories/{story_id}/summarize-batch",
    "POST /api/stories/{story_id}/summarize/character",
    "POST /api/stories/{story_id}/summarize/structure",
    "POST /api/stories/{story_id}/whatif",
    "POST /api/stories/{story_id}/worldbuilding/calendar-suggestions",
    "POST /api/stories/{story_id}/worldbuilding/historical-implications",
    "POST /api/stories/{story_id}/worldbuilding/suggest-elements",
    "POST /api/stories/{story_id}/worldbuilding/system-analysis",
    "POST /api/stories/{story_id}/worldbuilding/travel-analysis",
    "POST /api/stories/{story_id}/worldbuilding/what-exists",
    "POST /api/structure/{node_id}/summarize",
    "POST /api/threads/{thread_id}/analyze",
    "POST /api/twists/{twist_id}/analyze",
    "POST /api/twists/{twist_id}/analyze-impact",
)

CONVERSATIONS = (
    # Interviews, panels and Assistant sessions: a log of what was said, kept as it was said
    # (doc 05 §2.3). The author renames, clears or deletes a conversation; nobody undoes a reply.
    "DELETE /api/chronicle/sessions/{session_id}",
    "DELETE /api/interviews/{interview_id}",
    "DELETE /api/panels/{panel_id}",
    "PATCH /api/chronicle/sessions/{session_id}",
    "PATCH /api/interviews/{interview_id}",
    "POST /api/chat/summarize",
    "POST /api/chronicle/sessions",
    "POST /api/chronicle/sessions/{session_id}/fork",
    "POST /api/chronicle/sessions/{session_id}/generate-title",
    "POST /api/chronicle/sessions/{session_id}/messages",
    "POST /api/interviews/characters/{character_id}",
    "POST /api/interviews/{interview_id}/clear",
    "POST /api/interviews/{interview_id}/compact",
    "POST /api/interviews/{interview_id}/messages",
    "POST /api/interviews/{interview_id}/summarize",
    "POST /api/panels/{panel_id}/clear",
    "POST /api/panels/{panel_id}/compact",
    "POST /api/panels/{panel_id}/messages",
    "POST /api/stories/{story_id}/chat",
    "POST /api/stories/{story_id}/panels",
)

CHRONICLE = (
    # The Chronicle's own records: what happened, starred or noted. The history, not the story.
    "PATCH /api/chronicle/activity/{log_id}",
    "POST /api/chronicle/activity",
)

JOBS_AND_STREAMS = (
    # Queueing, stopping or nudging work in flight (doc 21). The work itself writes what it
    # writes; starting or stopping it changes nothing in the story.
    "POST /api/automatic/{task_id}/run",
    "POST /api/jobs/live/{call_id}/stop",
    "POST /api/jobs/seen",
    "POST /api/jobs/{job_id}/cancel",
    "POST /api/jobs/{job_id}/retry",
    "POST /api/jobs/{job_id}/run-next",
    "POST /api/jobs/{job_id}/start-now",
    "POST /api/stories/{story_id}/checks/{feature}",
    "POST /api/stories/{story_id}/editorial/jobs",
    "POST /api/stories/{story_id}/findings/local-checks",
    "POST /api/stories/{story_id}/jobs/scene-summaries",
    "POST /api/stories/{story_id}/numbers/readings/backfill",
    "POST /api/streams/{stream_id}/stop",
)

DERIVED = (
    # Rebuilding what is read from the story (dialogue lines, the Codex index, readings,
    # proposals, the findings feed): run again, it comes out the same. Nothing to undo.
    "POST /api/scenes/{scene_id}/dialogue/refresh",
    "POST /api/stories/{story_id}/codex/index",
    "POST /api/stories/{story_id}/codex/sync",
    "POST /api/stories/{story_id}/findings/run-local",
    "POST /api/stories/{story_id}/numbers/readings",
    "POST /api/stories/{story_id}/proposals/refresh",
)

READS = (
    # Sent as POST for the body, but they only read: previews, suggestions, a search, an
    # export download. What the author accepts goes through a route that records.
    "POST /api/characters/{character_id}/analyze-dialogue",
    "POST /api/characters/{character_id}/analyze-voice",
    "POST /api/characters/{character_id}/dialogue/suggest-tags-batch",
    "POST /api/characters/{character_id}/preview-pronoun-refactor",
    "POST /api/characters/{character_id}/preview-rename",
    "POST /api/characters/{character_id}/review",
    "POST /api/llm/prompt-preview",
    "POST /api/scenes/{scene_id}/dialogue/suggest-tags",
    "POST /api/stories/{story_id}/codex/presence",
    "POST /api/stories/{story_id}/dialogue/suggest-tags-batch",
    "POST /api/stories/{story_id}/export",
    "POST /api/stories/{story_id}/search",
    "POST /api/structure/{node_id}/suggest-links",
)

ACCOUNT_AND_APP = (
    # The author's account, sign-in, users and app-wide settings: not any story's, and the
    # change log is kept per story. Settings pages show and change their own state.
    "DELETE /api/ai-settings/core-prompt",
    "DELETE /api/ai-settings/feature-prompts/{feature_id}",
    "DELETE /api/llm-settings",
    "DELETE /api/users/{user_id}",
    "PATCH /api/ai-settings",
    "PATCH /api/auth/me",
    "PATCH /api/automatic",
    "PATCH /api/codex/settings",
    "PATCH /api/llm-settings",
    "POST /api/auth/login",
    "POST /api/system/backups",
    "POST /api/users",
    "PUT /api/auth/me/scratch-pad",
    "PUT /api/user/backup-defaults",
)

ACCOUNT_TEMPLATES = (
    # Structure templates and beat sheets belong to the account and serve every story; the
    # change log is per story, so there is no history for them to join.
    "DELETE /api/beat-sheets/{sheet_id}",
    "DELETE /api/templates/structures/{template_id}",
    "PATCH /api/templates/structures/{template_id}",
    "POST /api/beat-sheets",
    "POST /api/templates/structures",
    "PUT /api/beat-sheets/{sheet_id}",
)

SERIES = (
    # The series itself: its name, its books and their order, what it shares, its plan's arc
    # and axes. A series sits above its books and a change to it reaches several of them
    # (joining brings the series' shared research into the book; leaving drops the book's
    # cross-book links), so no one book's history can own it. What changes inside one book
    # (a book's part of the plan, carrying a cast over, adopting an element) is recorded there.
    # Planned books (/books, /shape) are new stories, which no change log holds (WHOLE_STORIES).
    "DELETE /api/series/{series_id}",
    "DELETE /api/series/{series_id}/elements/{element_id}",
    "DELETE /api/series/{series_id}/stories/{story_id}",
    "PATCH /api/series/{series_id}",
    "PATCH /api/series/{series_id}/field-classes",
    "POST /api/series",
    "POST /api/series/{series_id}/books",
    "POST /api/series/{series_id}/elements",
    "POST /api/series/{series_id}/shape",
    "POST /api/series/{series_id}/stories",
    "PUT /api/series/{series_id}/arc",
    "PUT /api/series/{series_id}/axes",
    "PUT /api/series/{series_id}/stories",
)

SNAPSHOTS = (
    # Snapshots are the long history, kept beside the change log: taking, naming, importing
    # and deleting one (which removes its file on disk too), and when they are taken.
    "DELETE /api/stories/{story_id}/snapshots/{snapshot_id}",
    "PATCH /api/stories/{story_id}/snapshots/{snapshot_id}",
    "POST /api/stories/{story_id}/snapshots",
    "POST /api/stories/{story_id}/snapshots/check-auto",
    "POST /api/stories/{story_id}/snapshots/import",
    "PUT /api/stories/{story_id}/backup-settings",
)

MEDIA_FILES = (
    # Uploading, replacing or deleting an image's file. The file on disk is not in the change
    # log; attaching, detaching and editing an image's details are.
    "DELETE /api/media/{asset_id}",
    "POST /api/stories/{story_id}/media/upload",
    "PUT /api/media/{asset_id}/file",
)

FREEWRITE = (
    # Freewrite is typed text with its own editor history, like prose (doc 15).
    "POST /api/stories/{story_id}/freewrite/append",
    "PUT /api/stories/{story_id}/freewrite",
)

WHOLE_STORIES = (
    # Making, importing or deleting a whole story: the change log lives inside a story, so it
    # cannot hold the story's own birth or death. Snapshots and backups cover those.
    "DELETE /api/stories/{story_id}",
    "POST /api/import/upload",
    "POST /api/import/{session_id}/adjust",
    "POST /api/import/{session_id}/ai-analyze",
    "POST /api/import/{session_id}/enrich-candidates",
    "POST /api/import/{session_id}/enrich-candidates/jobs",
    "POST /api/import/{session_id}/extract-preview",
    "POST /api/import/{session_id}/finalize",
    "POST /api/stories",
    "POST /api/stories/import",
)

NOT_UNDOABLE_GROUPS: dict[str, tuple[str, ...]] = {
    "AI calls and analyses": AI_CALLS,
    "conversations": CONVERSATIONS,
    "Chronicle records": CHRONICLE,
    "jobs and streams": JOBS_AND_STREAMS,
    "derived data": DERIVED,
    "reads sent as POST": READS,
    "account and app settings": ACCOUNT_AND_APP,
    "account templates and beat sheets": ACCOUNT_TEMPLATES,
    "series-level": SERIES,
    "snapshots": SNAPSHOTS,
    "media files": MEDIA_FILES,
    "freewrite": FREEWRITE,
    "whole stories": WHOLE_STORIES,
}

NOT_UNDOABLE: dict[str, str] = {route: group for group, routes in NOT_UNDOABLE_GROUPS.items() for route in routes}

#: Listed routes the walker thinks record, because a function they call records on another
#: path. Each says what the walker cannot see.
WALKER_OVERREACH: dict[str, str] = {
    "POST /api/series": "attach_story -> adopt_shared copies shared research with log=False",
    "POST /api/series/{series_id}/stories": "attach_story -> adopt_shared copies shared research with log=False",
    "POST /api/series/{series_id}/books": "attach_story -> adopt_shared copies shared research with log=False",
}


# ── The walk ─────────────────────────────────────────────────────────────────────


def _routes(routes, prefix: str = "") -> Iterator[tuple[str, APIRoute]]:
    """Every APIRoute with its full path. Included routers arrive wrapped (``_IncludedRouter``)."""
    for r in routes:
        if isinstance(r, APIRoute):
            yield prefix + r.path, r
        elif hasattr(r, "original_router"):
            yield from _routes(r.original_router.routes, prefix + (r.include_context.prefix or ""))


def mutating_routes() -> dict[str, Callable]:
    found: dict[str, Callable] = {}
    for path, route in _routes(app.routes):
        for method in sorted(route.methods & MUTATING):
            found[f"{method} {path}"] = route.endpoint
    return found


def _local_imports(tree: ast.AST, module) -> dict[str, object]:
    """Names a function imports inside its own body (``from ..services import x``)."""
    names: dict[str, object] = {}
    package = (module.__name__ if hasattr(module, "__path__") else module.__name__.rpartition(".")[0]) or None
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            source = "." * node.level + (node.module or "")
            try:
                imported = importlib.import_module(source, package)
            except ImportError:
                continue
            for alias in node.names:
                target = getattr(imported, alias.name, None)
                if target is None:
                    try:
                        target = importlib.import_module(f"{imported.__name__}.{alias.name}")
                    except ImportError:
                        continue
                names[alias.asname or alias.name] = target
    return names


def _resolve(call: ast.Call, scope: Callable[[str], object]) -> object | None:
    func = call.func
    if isinstance(func, ast.Name):
        return scope(func.id)
    if isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name):
        owner = scope(func.value.id)
        return getattr(owner, func.attr, None) if owner is not None else None
    return None


def records(fn: Callable, depth: int = 0, seen: set | None = None) -> bool:
    """Whether ``fn``, or an app function it calls (up to ``MAX_DEPTH`` deep), writes a change."""
    seen = set() if seen is None else seen
    if fn in seen or depth > MAX_DEPTH:
        return False
    seen.add(fn)
    try:
        tree = ast.parse(textwrap.dedent(inspect.getsource(fn)))
    except (OSError, TypeError):
        return False
    module = inspect.getmodule(fn)
    local = _local_imports(tree, module)

    def scope(name: str) -> object:
        return local[name] if name in local else getattr(module, name, None)

    callees = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            target = _resolve(node, scope)
            if any(target is r for r in RECORDERS):
                return True
            if callable(target) and (getattr(target, "__module__", None) or "").startswith("app."):
                callees.append(target)
    return any(records(c, depth + 1, seen) for c in callees)


# ── The tests ────────────────────────────────────────────────────────────────────


def test_allowlist_has_no_route_twice():
    flat = [route for routes in NOT_UNDOABLE_GROUPS.values() for route in routes]
    assert len(flat) == len(set(flat)), sorted({r for r in flat if flat.count(r) > 1})


def test_every_mutating_route_records_or_says_why_not():
    unaccounted = sorted(
        key for key, endpoint in mutating_routes().items() if key not in NOT_UNDOABLE and not records(endpoint)
    )
    assert not unaccounted, (
        "These routes change data but record nothing in the change log, so Undo cannot reverse them:\n  "
        + "\n  ".join(unaccounted)
        + "\nRecord the change (services/change_log.py: record, record_update, record_row_create, "
        "record_row_delete, or prose_writer for prose) in the same transaction, or add the route to "
        "NOT_UNDOABLE in tests/test_undo_coverage.py under the group that says why it is not undoable."
    )


def test_allowlist_is_current():
    routes = mutating_routes()
    gone = sorted(key for key in NOT_UNDOABLE if key not in routes)
    assert not gone, f"NOT_UNDOABLE lists routes that no longer exist; take them out: {gone}"
    now_records = sorted(key for key in NOT_UNDOABLE if key not in WALKER_OVERREACH and records(routes[key]))
    assert not now_records, f"These routes record their changes now; take them out of NOT_UNDOABLE: {now_records}"
    stale = sorted(key for key in WALKER_OVERREACH if key not in NOT_UNDOABLE or not records(routes[key]))
    assert not stale, f"WALKER_OVERREACH no longer needs these (or they left NOT_UNDOABLE): {stale}"


def test_the_walker_sees_through_helpers():
    """A route that records through a helper counts (character_milestones._save -> record_update);
    one that only reads does not."""
    routes = mutating_routes()
    assert records(routes["POST /api/characters/{character_id}/milestones"])
    assert records(routes["POST /api/locations/{location_id}/merge"])  # services/location_merge
    assert not records(routes["POST /api/stories/{story_id}/search"])
