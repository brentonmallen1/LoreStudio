"""Ideas and open questions (doc 10 P2, P3)

- stories.idea_fragments: the brain dump, as a list of fragments the author sorts. Each is
  {"id", "text", "created_at", "filed": null | {"kind", "ref_id", "label"}}; a filed
  fragment records what it became (a character, a place, a scene, a question...).
- story_todos grows a kind: "todo" (as before) or "question", for what the author has not
  decided yet. A question can be about a character or a place (about_type / about_id, no
  foreign key, so deleting the character never fails on it) or a scene (node_id, as
  before), and records its answer when it is settled.

Revision ID: 0017_ideas_and_questions
Revises: 0016_planning_fields
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017_ideas_and_questions"
down_revision: str | None = "0016_planning_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("stories", schema=None) as batch_op:
        batch_op.add_column(sa.Column("idea_fragments", sa.JSON(), server_default="[]", nullable=False))
    with op.batch_alter_table("story_todos", schema=None) as batch_op:
        batch_op.add_column(sa.Column("kind", sa.String(), server_default="todo", nullable=False))
        batch_op.add_column(sa.Column("about_type", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("about_id", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("answer", sa.Text(), server_default="", nullable=False))


def downgrade() -> None:
    for table, column in (
        ("story_todos", "answer"),
        ("story_todos", "about_id"),
        ("story_todos", "about_type"),
        ("story_todos", "kind"),
        ("stories", "idea_fragments"),
    ):
        op.execute(f"ALTER TABLE {table} DROP COLUMN {column}")
