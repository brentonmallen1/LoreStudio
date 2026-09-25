"""codex_edges: one edge per pair *per source*

The suggestion pass proposes that a character named in a scene was actually present in
it — an upgrade from the derived "mentioned" edge to a proposed "participant". With the
unique constraint on (story, src, dst, kind), the proposal could not coexist with the
edge it was upgrading, and inserting it failed the whole job. Adding `source` lets a
settled edge and the question about it sit side by side; everything that reads presence
already filters to settled edges.

Revision ID: 0013_codex_edge_per_source
Revises: 0012_activity_log_cost
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0013_codex_edge_per_source"
down_revision: str | None = "0012_activity_log_cost"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("codex_edges", schema=None) as batch_op:
        batch_op.drop_constraint("uq_codex_edge", type_="unique")
        batch_op.create_unique_constraint("uq_codex_edge", ["story_id", "src_id", "dst_id", "kind", "source"])


def downgrade() -> None:
    # Proposals that share a pair with a settled edge have nowhere to go under the old
    # constraint; they are questions, not records, so they are the ones dropped.
    op.execute(
        """
        DELETE FROM codex_edges
        WHERE source = 'llm' AND confirmed_at IS NULL AND EXISTS (
            SELECT 1 FROM codex_edges AS other
            WHERE other.story_id = codex_edges.story_id AND other.src_id = codex_edges.src_id
              AND other.dst_id = codex_edges.dst_id AND other.kind = codex_edges.kind
              AND other.id != codex_edges.id
        )
        """
    )
    with op.batch_alter_table("codex_edges", schema=None) as batch_op:
        batch_op.drop_constraint("uq_codex_edge", type_="unique")
        batch_op.create_unique_constraint("uq_codex_edge", ["story_id", "src_id", "dst_id", "kind"])
