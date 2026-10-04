"""Series: books in order, and the elements they share

A series is an ordered list of books; a series element says which rows in different books
are the same character, place or world element. No existing table changes: each book keeps
its own complete rows, and these tables only link them.

Revision ID: 0029_series
Revises: 0028_promise_roles
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0029_series"
down_revision: str | None = "0028_promise_roles"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "series",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("premise", sa.Text(), server_default="", nullable=False),
        sa.Column("intent", sa.Text(), server_default="", nullable=False),
        sa.Column("field_classes", sa.JSON(), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("series", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_series_user_id"), ["user_id"], unique=False)

    op.create_table(
        "series_elements",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("series_id", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["series_id"],
            ["series.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("series_elements", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_series_elements_series_id"), ["series_id"], unique=False)

    op.create_table(
        "series_stories",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("series_id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["series_id"],
            ["series.id"],
        ),
        sa.ForeignKeyConstraint(
            ["story_id"],
            ["stories.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("story_id", name="uq_series_story"),
    )
    with op.batch_alter_table("series_stories", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_series_stories_series_id"), ["series_id"], unique=False)

    op.create_table(
        "series_element_members",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("element_id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), nullable=False),
        sa.Column("ref_table", sa.String(), nullable=False),
        sa.Column("ref_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["element_id"],
            ["series_elements.id"],
        ),
        sa.ForeignKeyConstraint(
            ["story_id"],
            ["stories.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("element_id", "story_id", name="uq_series_element_member"),
    )
    with op.batch_alter_table("series_element_members", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_series_element_members_element_id"), ["element_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_series_element_members_ref_id"), ["ref_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_series_element_members_story_id"), ["story_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("series_element_members", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_series_element_members_story_id"))
        batch_op.drop_index(batch_op.f("ix_series_element_members_ref_id"))
        batch_op.drop_index(batch_op.f("ix_series_element_members_element_id"))

    op.drop_table("series_element_members")
    with op.batch_alter_table("series_stories", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_series_stories_series_id"))

    op.drop_table("series_stories")
    with op.batch_alter_table("series_elements", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_series_elements_series_id"))

    op.drop_table("series_elements")
    with op.batch_alter_table("series", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_series_user_id"))

    op.drop_table("series")
