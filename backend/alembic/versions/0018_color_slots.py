"""Palette slots for characters, places and plot threads (doc 11 P2)

A colour slot 1..8 replaces a hex colour: every theme paints the slots in its own inks,
so the same character is the same colour in every palette and always readable. Threads
kept a raw hex until now (the old preset list); it maps to the nearest slot and the
column goes. Existing characters and places take slots in creation order so a cast
comes out distinct without anyone choosing.

Revision ID: 0018_color_slots
Revises: 0017_ideas_and_questions
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0018_color_slots"
down_revision: str | None = "0017_ideas_and_questions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SLOT_COUNT = 8
PRESET_SLOTS = {
    "#3b82f6": 1,
    "#ef4444": 2,
    "#f97316": 2,
    "#22c55e": 3,
    "#10b981": 3,
    "#8b5cf6": 4,
    "#a78bfa": 4,
    "#f59e0b": 5,
    "#ec4899": 6,
    "#14b8a6": 7,
    "#06b6d4": 7,
    "#6b7280": 8,
}


def _assign_by_order(conn, table: str) -> None:
    rows = conn.execute(sa.text(f"SELECT id, story_id FROM {table} ORDER BY story_id, created_at, id")).fetchall()
    counters: dict[str, int] = {}
    for row_id, story_id in rows:
        n = counters.get(story_id, 0)
        counters[story_id] = n + 1
        conn.execute(
            sa.text(f"UPDATE {table} SET color_slot = :slot WHERE id = :id"),
            {"slot": (n % SLOT_COUNT) + 1, "id": row_id},
        )


def upgrade() -> None:
    for table in ("characters", "locations", "plot_threads"):
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.add_column(sa.Column("color_slot", sa.Integer(), server_default="0", nullable=False))

    conn = op.get_bind()
    _assign_by_order(conn, "characters")
    _assign_by_order(conn, "locations")
    # Threads: the old preset hex, if it is one, else creation order within the story.
    rows = conn.execute(sa.text("SELECT id, story_id, color FROM plot_threads ORDER BY story_id, created_at, id")).fetchall()
    counters: dict[str, int] = {}
    for row_id, story_id, color in rows:
        n = counters.get(story_id, 0)
        counters[story_id] = n + 1
        slot = PRESET_SLOTS.get((color or "").strip().lower(), (n % SLOT_COUNT) + 1)
        conn.execute(sa.text("UPDATE plot_threads SET color_slot = :slot WHERE id = :id"), {"slot": slot, "id": row_id})
    # Native ALTER: a batch rebuild fails on parent tables with foreign_keys=ON.
    op.execute("ALTER TABLE plot_threads DROP COLUMN color")


def downgrade() -> None:
    with op.batch_alter_table("plot_threads", schema=None) as batch_op:
        batch_op.add_column(sa.Column("color", sa.String(), server_default="#6b7280", nullable=False))
    for table in ("plot_threads", "locations", "characters"):
        op.execute(f"ALTER TABLE {table} DROP COLUMN color_slot")
