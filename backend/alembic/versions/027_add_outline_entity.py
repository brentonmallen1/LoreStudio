"""Add Outline entity and migrate outline_items to use outline_id.

Revision ID: 027
Revises: 026
Create Date: 2026-04-10
"""
import uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text, inspect

revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Create outlines table only if it doesn't already exist
    #    (create_all may have already made it from the model)
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()

    if "outlines" not in existing_tables:
        op.create_table(
            "outlines",
            sa.Column("id", sa.String(), nullable=False, primary_key=True),
            sa.Column("story_id", sa.String(), sa.ForeignKey("stories.id"), nullable=False),
            sa.Column("name", sa.String(), nullable=False, server_default="Outline"),
            sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("source_beat_sheet_id", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )

    # 2. Check if outline_items still has story_id (migration may be partial)
    item_cols = {c["name"] for c in inspector.get_columns("outline_items")}
    if "story_id" not in item_cols:
        # Already migrated — nothing to do
        return

    # 3. For each story that has outline_items, create a default Outline
    stories_with_items = conn.execute(
        text("SELECT DISTINCT story_id FROM outline_items")
    ).fetchall()

    story_to_outline: dict[str, str] = {}
    for row in stories_with_items:
        story_id = row[0]
        # Check if an outline already exists for this story
        existing = conn.execute(
            text("SELECT id FROM outlines WHERE story_id = :story_id LIMIT 1"),
            {"story_id": story_id},
        ).fetchone()
        if existing:
            story_to_outline[story_id] = existing[0]
        else:
            outline_id = str(uuid.uuid4())
            story_to_outline[story_id] = outline_id
            conn.execute(
                text(
                    "INSERT INTO outlines (id, story_id, name, position, created_at, updated_at) "
                    "VALUES (:id, :story_id, 'Outline', 0, datetime('now'), datetime('now'))"
                ),
                {"id": outline_id, "story_id": story_id},
            )

    # 4. Add outline_id column to outline_items (nullable first)
    if "outline_id" not in item_cols:
        with op.batch_alter_table("outline_items") as batch_op:
            batch_op.add_column(sa.Column("outline_id", sa.String(), nullable=True))

    # 5. Populate outline_id from the mapping
    for story_id, outline_id in story_to_outline.items():
        conn.execute(
            text("UPDATE outline_items SET outline_id = :outline_id WHERE story_id = :story_id"),
            {"outline_id": outline_id, "story_id": story_id},
        )

    # 6. Drop story_id and make outline_id non-nullable
    with op.batch_alter_table("outline_items") as batch_op:
        batch_op.drop_column("story_id")
        batch_op.alter_column("outline_id", nullable=False)
        batch_op.create_foreign_key("fk_outline_items_outline_id", "outlines", ["outline_id"], ["id"])


def downgrade() -> None:
    conn = op.get_bind()

    with op.batch_alter_table("outline_items") as batch_op:
        batch_op.add_column(sa.Column("story_id", sa.String(), nullable=True))

    conn.execute(
        text(
            "UPDATE outline_items SET story_id = ("
            "SELECT story_id FROM outlines WHERE outlines.id = outline_items.outline_id"
            ")"
        )
    )

    with op.batch_alter_table("outline_items") as batch_op:
        batch_op.drop_constraint("fk_outline_items_outline_id", type_="foreignkey")
        batch_op.drop_column("outline_id")
        batch_op.alter_column("story_id", nullable=False)

    op.drop_table("outlines")
