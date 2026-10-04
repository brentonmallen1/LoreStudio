"""Promises: one list of scenes per thread, clues as rows, a colour per twist (doc 18 C1)

- A thread's appearances carry a role: opens, moves, turns, complicates, a try (fails,
  fails_worse, costs, succeeds) or closes. The opening and closing scenes and the try/fail
  cycles become roles on the scenes they name, adding the scene to the thread when it was not
  in its list; a cycle's description joins the scene's note.
- A thread's status follows from its scenes; the author can only set it aside. A thread
  marked resolved with no closing scene reads as open from now on.
- Clues leave the twist's JSON for ``twist_clues`` rows, in the order they were listed. A clue
  naming a scene that is gone, or another story's, keeps its words and loses the scene.
- A twist has a colour slot (7, teal) and a status that follows from its clues and reveal.

Revision ID: 0028_promise_roles
Revises: 0027_promise_data
"""

import json
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "0028_promise_roles"
down_revision: str | None = "0027_promise_data"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OUTCOME_ROLES = {
    "fail_setback": "fails",
    "fail_disaster": "fails_worse",
    "success_cost": "costs",
    "success_clean": "succeeds",
    "success_partial": "costs",
}
TRY_OUTCOMES = {"fails": "fail_setback", "fails_worse": "fail_disaster", "costs": "success_cost", "succeeds": "success_clean"}
POINTS = {"truth", "misdirection"}
SUBTLETIES = {"obvious", "moderate", "subtle", "hidden"}


def _as_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            return []
    return list(value) if isinstance(value, list) else []


def _join(note: str, more: str) -> str:
    note, more = (note or "").strip(), (more or "").strip()
    if not more or more in note:
        return note
    return f"{note}\n{more}" if note else more


def upgrade() -> None:
    bind = op.get_bind()
    now = datetime.now(UTC).replace(tzinfo=None)

    # In place: rebuilding plot_threads or twists trips the foreign keys that point at them.
    op.add_column(
        "plot_thread_appearances", sa.Column("role", sa.String(), server_default="moves", nullable=False)
    )
    op.add_column("plot_threads", sa.Column("set_aside", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("twists", sa.Column("color_slot", sa.Integer(), server_default="7", nullable=False))
    op.create_table(
        "twist_clues",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("twist_id", sa.String(), nullable=False),
        sa.Column("node_id", sa.String(), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("points_to", sa.String(), nullable=False),
        sa.Column("subtlety", sa.String(), nullable=False),
        sa.Column("quote", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["twist_id"], ["twists.id"]),
        sa.ForeignKeyConstraint(["node_id"], ["structure_nodes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_twist_clues_twist_id", "twist_clues", ["twist_id"])
    op.create_index("ix_twist_clues_node_id", "twist_clues", ["node_id"])

    nodes_of: dict[str, set[str]] = {}

    def story_nodes(story_id: str) -> set[str]:
        if story_id not in nodes_of:
            nodes_of[story_id] = {
                r[0]
                for r in bind.execute(
                    sa.text("SELECT id FROM structure_nodes WHERE story_id = :s"), {"s": story_id}
                ).fetchall()
            }
        return nodes_of[story_id]

    threads = bind.execute(
        sa.text("SELECT id, story_id, opens_at_node_id, closes_at_node_id, try_fail_cycles FROM plot_threads")
    ).fetchall()
    for thread_id, story_id, opens, closes, cycles in threads:
        nodes = story_nodes(story_id)
        rows = {
            node_id: {"id": app_id, "role": "moves", "note": note or "", "new": False}
            for app_id, node_id, note in bind.execute(
                sa.text("SELECT id, node_id, note FROM plot_thread_appearances WHERE thread_id = :t"),
                {"t": thread_id},
            ).fetchall()
        }

        def place(node_id, role: str | None, note: str = "") -> None:
            if not node_id or node_id not in nodes:
                return
            row = rows.get(node_id)
            if row is None:
                row = rows[node_id] = {"id": str(uuid.uuid4()), "role": "moves", "note": "", "new": True}
            # Opening and closing outrank a try in the same scene; the try's words still count.
            if role and row["role"] not in ("opens", "closes"):
                row["role"] = role
            row["note"] = _join(row["note"], note)

        place(opens, "opens")
        place(closes, "closes")
        for cycle in _as_list(cycles):
            if isinstance(cycle, dict):
                place(cycle.get("node_id"), OUTCOME_ROLES.get(cycle.get("outcome") or "", "fails"), cycle.get("description") or "")

        for node_id, row in rows.items():
            if row["new"]:
                bind.execute(
                    sa.text(
                        "INSERT INTO plot_thread_appearances (id, thread_id, node_id, role, note, created_at) "
                        "VALUES (:id, :t, :n, :r, :note, :at)"
                    ),
                    {"id": row["id"], "t": thread_id, "n": node_id, "r": row["role"], "note": row["note"], "at": now},
                )
            else:
                bind.execute(
                    sa.text("UPDATE plot_thread_appearances SET role = :r, note = :note WHERE id = :id"),
                    {"r": row["role"], "note": row["note"], "id": row["id"]},
                )

    for twist_id, story_id, clues in bind.execute(sa.text("SELECT id, story_id, clues FROM twists")).fetchall():
        nodes = story_nodes(story_id)
        seen: set[str] = set()
        for position, clue in enumerate(c for c in _as_list(clues) if isinstance(c, dict)):
            clue_id = str(clue.get("id") or "") or str(uuid.uuid4())
            if clue_id in seen:
                clue_id = str(uuid.uuid4())
            seen.add(clue_id)
            node_id = clue.get("node_id")
            bind.execute(
                sa.text(
                    "INSERT INTO twist_clues (id, twist_id, node_id, text, points_to, subtlety, quote, position, "
                    "created_at) VALUES (:id, :t, :n, :text, :p, :s, '', :pos, :at)"
                ),
                {
                    "id": clue_id,
                    "t": twist_id,
                    "n": node_id if node_id in nodes else None,
                    "text": str(clue.get("text") or ""),
                    "p": clue.get("points_to") if clue.get("points_to") in POINTS else "truth",
                    "s": clue.get("subtlety") if clue.get("subtlety") in SUBTLETIES else "moderate",
                    "pos": position,
                    "at": now,
                },
            )

    for table, column in (
        ("plot_threads", "status"),
        ("plot_threads", "opens_at_node_id"),
        ("plot_threads", "closes_at_node_id"),
        ("plot_threads", "try_fail_cycles"),
        ("twists", "status"),
        ("twists", "clues"),
    ):
        op.execute(f"ALTER TABLE {table} DROP COLUMN {column}")


def downgrade() -> None:
    bind = op.get_bind()
    op.add_column("plot_threads", sa.Column("status", sa.String(), nullable=True))
    op.add_column("plot_threads", sa.Column("opens_at_node_id", sa.String(), nullable=True))
    op.add_column("plot_threads", sa.Column("closes_at_node_id", sa.String(), nullable=True))
    op.add_column("plot_threads", sa.Column("try_fail_cycles", sa.JSON(), nullable=True))
    op.add_column("twists", sa.Column("status", sa.String(), nullable=True))
    op.add_column("twists", sa.Column("clues", sa.JSON(), nullable=True))

    for thread_id, set_aside in bind.execute(sa.text("SELECT id, set_aside FROM plot_threads")).fetchall():
        apps = bind.execute(
            sa.text("SELECT node_id, role, note FROM plot_thread_appearances WHERE thread_id = :t"), {"t": thread_id}
        ).fetchall()
        opens = next((n for n, r, _ in apps if r == "opens"), None)
        closes = next((n for n, r, _ in apps if r == "closes"), None)
        cycles = [
            {"id": str(uuid.uuid4()), "description": note or "", "outcome": TRY_OUTCOMES[r], "node_id": n}
            for n, r, note in apps
            if r in TRY_OUTCOMES
        ]
        status = "resolved" if closes else "developing" if apps and not set_aside else "open"
        bind.execute(
            sa.text(
                "UPDATE plot_threads SET status = :s, opens_at_node_id = :o, closes_at_node_id = :c, "
                "try_fail_cycles = :y WHERE id = :id"
            ),
            {"s": status, "o": opens, "c": closes, "y": json.dumps(cycles), "id": thread_id},
        )

    for twist_id, revealed in bind.execute(sa.text("SELECT id, revealed_at_node_id FROM twists")).fetchall():
        clues = [
            {"id": i, "node_id": n, "text": t, "points_to": p, "subtlety": s}
            for i, n, t, p, s in bind.execute(
                sa.text(
                    "SELECT id, node_id, text, points_to, subtlety FROM twist_clues WHERE twist_id = :t "
                    "ORDER BY position"
                ),
                {"t": twist_id},
            ).fetchall()
        ]
        status = "revealed" if revealed else "seeding" if any(c["node_id"] for c in clues) else "planned"
        bind.execute(
            sa.text("UPDATE twists SET status = :s, clues = :c WHERE id = :id"),
            {"s": status, "c": json.dumps(clues), "id": twist_id},
        )

    op.drop_index("ix_twist_clues_node_id", table_name="twist_clues")
    op.drop_index("ix_twist_clues_twist_id", table_name="twist_clues")
    op.drop_table("twist_clues")
    op.execute("ALTER TABLE twists DROP COLUMN color_slot")
    op.execute("ALTER TABLE plot_threads DROP COLUMN set_aside")
    op.execute("ALTER TABLE plot_thread_appearances DROP COLUMN role")
