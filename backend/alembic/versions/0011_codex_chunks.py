"""codex_chunks: the passages the semantic index is built from

Refactor doc 07 §4. A chunk is a slice of something the author wrote, tied to the Codex
node it came from so a retrieved passage can say why it was retrieved. The vector is a
BLOB of packed float32 rather than a `vec0` virtual table: exact search over one story is
fast either way, and an ordinary table still works when SQLite has no extensions.

Revision ID: 0011_codex_chunks
Revises: 0010_scene_presence
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_codex_chunks"
down_revision: str | None = "0010_scene_presence"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "codex_chunks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), nullable=False),
        sa.Column("node_id", sa.String(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column("embedding", sa.LargeBinary(), nullable=True),
        sa.Column("embed_model", sa.String(), nullable=False),
        sa.Column("dim", sa.Integer(), nullable=False),
        sa.Column("text_hash", sa.String(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["node_id"], ["codex_nodes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("node_id", "chunk_index", name="uq_codex_chunk"),
    )
    with op.batch_alter_table("codex_chunks", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_codex_chunks_story_id"), ["story_id"], unique=False)
        batch_op.create_index("ix_codex_chunks_story", ["story_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("codex_chunks", schema=None) as batch_op:
        batch_op.drop_index("ix_codex_chunks_story")
        batch_op.drop_index(batch_op.f("ix_codex_chunks_story_id"))
    op.drop_table("codex_chunks")
