"""codex_nodes and codex_edges: the story knowledge graph

Refactor doc 07 §2. Mostly a view over tables that already exist — the graph earns its keep
by making the relationships between them queryable. `source` records where each node and
edge came from, because an edge the author wrote is a different claim from one a model
proposed, and a rebuild may throw away only what it generated.

Revision ID: 0009_codex_graph
Revises: 0008_ai_jobs
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009_codex_graph"
down_revision: str | None = "0008_ai_jobs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "codex_nodes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("ref_table", sa.String(), nullable=False),
        sa.Column("ref_id", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("props", sa.JSON(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("story_id", "kind", "ref_id", name="uq_codex_node_ref"),
    )
    with op.batch_alter_table("codex_nodes", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_codex_nodes_story_id"), ["story_id"], unique=False)
        batch_op.create_index("ix_codex_nodes_story_kind", ["story_id", "kind"], unique=False)

    op.create_table(
        "codex_edges",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), nullable=False),
        sa.Column("src_id", sa.String(), nullable=False),
        sa.Column("dst_id", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("props", sa.JSON(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["dst_id"], ["codex_nodes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["src_id"], ["codex_nodes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["story_id"], ["stories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("story_id", "src_id", "dst_id", "kind", name="uq_codex_edge"),
    )
    with op.batch_alter_table("codex_edges", schema=None) as batch_op:
        batch_op.create_index("ix_codex_edges_dst", ["dst_id", "kind"], unique=False)
        batch_op.create_index("ix_codex_edges_src", ["src_id", "kind"], unique=False)
        batch_op.create_index(batch_op.f("ix_codex_edges_story_id"), ["story_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("codex_edges", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_codex_edges_story_id"))
        batch_op.drop_index("ix_codex_edges_src")
        batch_op.drop_index("ix_codex_edges_dst")
    op.drop_table("codex_edges")
    with op.batch_alter_table("codex_nodes", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_codex_nodes_story_id"))
        batch_op.drop_index("ix_codex_nodes_story_kind")
    op.drop_table("codex_nodes")
