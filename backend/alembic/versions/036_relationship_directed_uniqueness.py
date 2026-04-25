"""enforce directed uniqueness on character_relationships (character_id, related_character_id)

Revision ID: 036_relationship_directed_uniqueness
Revises: 035_merge_relationship_extensions
Create Date: 2026-04-18
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "036_relationship_directed_uniqueness"
down_revision: Union[str, None] = "035_merge_relationship_extensions"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # --- Step 1: deduplicate existing rows ---
    # For each (character_id, related_character_id) pair with duplicates, keep the row
    # that has the most data (longest description + notes), breaking ties by created_at desc.
    dupes = conn.execute(text("""
        SELECT character_id, related_character_id, COUNT(*) as cnt
        FROM character_relationships
        GROUP BY character_id, related_character_id
        HAVING cnt > 1
    """)).fetchall()

    for row in dupes:
        char_id, related_id = row[0], row[1]
        # Rank duplicates: prefer rows with more content (description + notes), then newer
        all_rows = conn.execute(text("""
            SELECT id,
                   LENGTH(COALESCE(description, '')) + LENGTH(COALESCE(notes, '')) AS content_len,
                   created_at
            FROM character_relationships
            WHERE character_id = :cid AND related_character_id = :rid
            ORDER BY content_len DESC, created_at DESC
        """), {"cid": char_id, "rid": related_id}).fetchall()

        # Keep the first (most content / most recent), delete the rest
        ids_to_delete = [r[0] for r in all_rows[1:]]
        for del_id in ids_to_delete:
            conn.execute(text("DELETE FROM character_relationships WHERE id = :id"), {"id": del_id})

    # --- Step 2: create the unique index ---
    # SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we use a unique index instead.
    op.create_index(
        "uq_relationship_directed_pair",
        "character_relationships",
        ["character_id", "related_character_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_relationship_directed_pair", table_name="character_relationships")
