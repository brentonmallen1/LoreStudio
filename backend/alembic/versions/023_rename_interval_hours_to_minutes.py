"""Rename interval_hours to interval_minutes (default 30) in backup settings tables.

Revision ID: 023
Revises: 022
Create Date: 2026-04-09
"""
from alembic import op
import sqlalchemy as sa

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # story_backup_settings
    with op.batch_alter_table("story_backup_settings") as batch_op:
        batch_op.add_column(sa.Column("interval_minutes", sa.Integer(), nullable=True))
    op.execute("UPDATE story_backup_settings SET interval_minutes = interval_hours * 60")
    with op.batch_alter_table("story_backup_settings") as batch_op:
        batch_op.drop_column("interval_hours")

    # user_backup_defaults
    with op.batch_alter_table("user_backup_defaults") as batch_op:
        batch_op.add_column(sa.Column("interval_minutes", sa.Integer(), nullable=True))
    op.execute("UPDATE user_backup_defaults SET interval_minutes = interval_hours * 60")
    with op.batch_alter_table("user_backup_defaults") as batch_op:
        batch_op.drop_column("interval_hours")


def downgrade() -> None:
    with op.batch_alter_table("story_backup_settings") as batch_op:
        batch_op.add_column(sa.Column("interval_hours", sa.Integer(), nullable=True))
    op.execute("UPDATE story_backup_settings SET interval_hours = MAX(1, CAST(interval_minutes / 60 AS INTEGER))")
    with op.batch_alter_table("story_backup_settings") as batch_op:
        batch_op.drop_column("interval_minutes")

    with op.batch_alter_table("user_backup_defaults") as batch_op:
        batch_op.add_column(sa.Column("interval_hours", sa.Integer(), nullable=True))
    op.execute("UPDATE user_backup_defaults SET interval_hours = MAX(1, CAST(interval_minutes / 60 AS INTEGER))")
    with op.batch_alter_table("user_backup_defaults") as batch_op:
        batch_op.drop_column("interval_minutes")
