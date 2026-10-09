#!/usr/bin/env python3
"""File-length budget: a file should stay something you can hold in your head.

Adapted from IGAB's scripts/check-size.py. Ruff has no file-length rule and
eslint's max-lines would only cover half the tree, so the budget for both
halves lives here: one place, one debt list, one number to watch.

What counts is CODE lines: blank lines, comments and docstrings are free, so a
long teaching docstring is never taxed and a comment reflow never moves the
number. Python is counted through tokenize + an AST docstring pass; TypeScript
through a small scanner (a line counts when any token sits on it outside a
comment; string contents are code).

This is a ratchet, not a freeze. Files already over budget are recorded in
OVER_BUDGET with the size they had when the gate went in. They may shrink; they
may not grow past their lock plus SLACK. Everything else must come in under
budget. `--update` reprints the debt list with wins banked (it never raises a
number).

Usage:
    python3 scripts/check-size.py            # check
    python3 scripts/check-size.py --update   # reprint OVER_BUDGET from the tree
"""

from __future__ import annotations

import ast
import io
import sys
import tokenize
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

#: Code lines per file, by extension.
BUDGET = {".py": 800, ".ts": 500, ".tsx": 500}

#: Drift allowed past a lock before the gate fails. Flat, not a percentage.
SLACK = 10

#: Directories to walk. Tests are out: a table-driven suite is long because it
#: enumerates cases. Alembic versions and the seed data are out: generated or
#: pure data.
ROOTS = ("backend/app", "frontend/src")
SKIP_DIRS = ("backend/app/services/seed", "backend/alembic")
SKIP_SUFFIXES = (".test.ts", ".test.tsx", ".d.ts", ".generated.ts")
SKIP_FILES = ("backend/app/services/seed.py",)

#: Files over budget when this gate went in (Stage 0 of the 2026-09 refactor),
#: locked at their code-line count then. Sorted worst first: the top of this
#: list is the work. Lower a number when the file shrinks; delete the line when
#: it comes under budget. Never raise one.
OVER_BUDGET: dict[str, int] = {
    "backend/app/routers/analysis.py": 1458,
    "frontend/src/types/index.ts": 1493,
    "frontend/src/api/client.ts": 1085,
    "backend/app/services/llm/prompts/analysis.py": 1179,
    "backend/app/services/import_service.py": 878,
    "frontend/src/components/layout/CommandPalette.tsx": 587,
    "frontend/src/components/outline/OutlineManager.tsx": 680,
    "frontend/src/components/characters/RelationshipGraph.tsx": 626,
    "frontend/src/components/characters/CharacterFormDialog.tsx": 561,
    "frontend/src/components/story/StoryIdentityPanel.tsx": 527,
    "frontend/src/components/characters/CharacterDialogueTab.tsx": 515,
    "frontend/src/components/story/StoryboardView.tsx": 514,
}

_PY_NON_CODE_TOKENS = frozenset(
    {tokenize.COMMENT, tokenize.NL, tokenize.NEWLINE, tokenize.INDENT, tokenize.DEDENT, tokenize.ENDMARKER}
)


def python_code_lines(text: str) -> int:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", SyntaxWarning)
            tree = ast.parse(text)
        tokens = list(tokenize.generate_tokens(io.StringIO(text).readline))
    except (SyntaxError, tokenize.TokenError, ValueError):
        return len(text.splitlines())
    doc_lines: set[int] = set()
    for node in ast.walk(tree):
        if not isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        body = node.body
        if (
            body
            and isinstance(body[0], ast.Expr)
            and isinstance(body[0].value, ast.Constant)
            and isinstance(body[0].value.value, str)
            and body[0].end_lineno is not None
        ):
            doc_lines.update(range(body[0].lineno, body[0].end_lineno + 1))
    code_lines: set[int] = set()
    for tok in tokens:
        if tok.type in _PY_NON_CODE_TOKENS:
            continue
        code_lines.update(range(tok.start[0], tok.end[0] + 1))
    return len(code_lines - doc_lines)


def ts_code_lines(text: str) -> int:
    count = 0
    in_block = False
    in_string: str | None = None
    for line in text.splitlines():
        has_code = False
        i, n = 0, len(line)
        while i < n:
            ch = line[i]
            if in_string:
                has_code = True
                if ch == "\\":
                    i += 2
                    continue
                if ch == in_string:
                    in_string = None
                i += 1
                continue
            if in_block:
                if ch == "*" and i + 1 < n and line[i + 1] == "/":
                    in_block = False
                    i += 2
                    continue
                i += 1
                continue
            if ch in " \t":
                i += 1
                continue
            if ch == "/" and i + 1 < n and line[i + 1] == "/":
                break
            if ch == "/" and i + 1 < n and line[i + 1] == "*":
                in_block = True
                i += 2
                continue
            if ch in "'\"`":
                in_string = ch
                has_code = True
                i += 1
                continue
            has_code = True
            i += 1
        if in_string and in_string != "`":
            in_string = None
        if has_code:
            count += 1
    return count


def code_lines(path: Path, text: str) -> int:
    return python_code_lines(text) if path.suffix == ".py" else ts_code_lines(text)


def _self_test() -> None:
    py = '"""Module doc.\n\nTwo lines of prose.\n"""\n\n# comment\nx = 1\n\ny = (\n    2\n)\n'
    assert python_code_lines(py) == 4, python_code_lines(py)
    py_fn = 'def f():\n    """Doc."""\n    return 1\n'
    assert python_code_lines(py_fn) == 2, python_code_lines(py_fn)
    ts = "// header\n\nconst a = 1; // trailing\n/*\n block\n*/\nconst b = `x\n\ny`;\n"
    assert ts_code_lines(ts) == 3, ts_code_lines(ts)
    ts_str = 'const u = "http://x"; // real comment\n'
    assert ts_code_lines(ts_str) == 1, ts_code_lines(ts_str)


def measure() -> dict[str, int]:
    found: dict[str, int] = {}
    for root in ROOTS:
        base = ROOT / root
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            if not path.is_file() or path.suffix not in BUDGET:
                continue
            rel = path.relative_to(ROOT).as_posix()
            if rel in SKIP_FILES or any(rel.startswith(d + "/") for d in SKIP_DIRS):
                continue
            if any(path.name.endswith(s) for s in SKIP_SUFFIXES):
                continue
            found[rel] = code_lines(path, path.read_text(encoding="utf-8"))
    return found


def main() -> int:
    _self_test()
    sizes = measure()

    if "--update" in sys.argv:
        over = {rel: n for rel, n in sorted(sizes.items(), key=lambda kv: -kv[1]) if n > BUDGET[Path(rel).suffix]}
        for rel, n in over.items():
            print(f'    "{rel}": {min(n, OVER_BUDGET.get(rel, n))},')
        print(f"\n{len(over)} files over budget — paste the block above into OVER_BUDGET.")
        return 0

    problems: list[str] = []
    notes: list[str] = []
    for rel, allowed in sorted(OVER_BUDGET.items()):
        actual = sizes.get(rel)
        if actual is None:
            problems.append(f"{rel}: listed in OVER_BUDGET but not found — delete the line.")
        elif actual > allowed + SLACK:
            problems.append(
                f"{rel}: {actual} code lines, up from its lock of {allowed} (slack {SLACK}). Already over the "
                f"{BUDGET[Path(rel).suffix]}-line budget; it may shrink, not grow."
            )
        elif actual > allowed:
            notes.append(f"{rel}: {actual} code lines, {actual - allowed} over its lock — inside the slack.")
        elif actual < allowed:
            notes.append(
                f"{rel}: {actual} code lines, down from {allowed}"
                + (" — under budget now, delete its line." if actual <= BUDGET[Path(rel).suffix] else " — lower its lock.")
            )
    for rel, actual in sorted(sizes.items()):
        if rel in OVER_BUDGET:
            continue
        budget = BUDGET[Path(rel).suffix]
        if actual > budget:
            problems.append(f"{rel}: {actual} code lines, over the {budget}-line budget. Split it.")

    for note in notes:
        print(f"  · {note}")
    if problems:
        print("\nFile-length budget:\n")
        for p in problems:
            print(f"  ✗ {p}")
        print(f"\n{len(problems)} problem(s). `--update` reprints the OVER_BUDGET block.")
        return 1
    print(f"File-length budget: {len(sizes)} files, {len(OVER_BUDGET)} on the debt list.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
