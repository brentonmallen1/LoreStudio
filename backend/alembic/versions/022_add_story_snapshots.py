"""Add story snapshots and backup settings tables

Revision ID: 022
Revises: 021
Create Date: 2026-04-09
"""
from alembic import op
import sqlalchemy as sa

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "story_snapshots",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), sa.ForeignKey("stories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("trigger", sa.String(), nullable=False, server_default="manual"),
        sa.Column("snapshot_type", sa.String(), nullable=False, server_default="full"),
        sa.Column("base_snapshot_id", sa.String(), sa.ForeignKey("story_snapshots.id", ondelete="SET NULL"), nullable=True),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("summary", sa.JSON(), nullable=True),
        sa.Column("delta_summary", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_story_snapshots_story_id", "story_snapshots", ["story_id"])
    op.create_index("ix_story_snapshots_created_at", "story_snapshots", ["created_at"])

    op.create_table(
        "story_backup_settings",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), sa.ForeignKey("stories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("auto_enabled", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("interval_hours", sa.Integer(), nullable=False, server_default="24"),
        sa.Column("max_count", sa.Integer(), nullable=True, server_default="30"),
        sa.Column("max_age_days", sa.Integer(), nullable=True),
        sa.Column("last_auto_backup_at", sa.DateTime(), nullable=True),
        sa.Column("include_diagrams", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("include_interviews", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("include_chat_sessions", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("include_activity_logs", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("activity_log_limit", sa.Integer(), nullable=True, server_default="500"),
        sa.Column("include_media_assets", sa.Boolean(), nullable=False, server_default="1"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("story_id"),
    )
    op.create_index("ix_story_backup_settings_story_id", "story_backup_settings", ["story_id"])

    op.create_table(
        "user_backup_defaults",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("auto_enabled", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("interval_hours", sa.Integer(), nullable=False, server_default="24"),
        sa.Column("max_count", sa.Integer(), nullable=True, server_default="30"),
        sa.Column("max_age_days", sa.Integer(), nullable=True),
        sa.Column("include_diagrams", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("include_interviews", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("include_chat_sessions", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("include_activity_logs", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("activity_log_limit", sa.Integer(), nullable=True, server_default="500"),
        sa.Column("include_media_assets", sa.Boolean(), nullable=False, server_default="1"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_user_backup_defaults_user_id", "user_backup_defaults", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_backup_defaults_user_id", table_name="user_backup_defaults")
    op.drop_table("user_backup_defaults")
    op.drop_index("ix_story_backup_settings_story_id", table_name="story_backup_settings")
    op.drop_table("story_backup_settings")
    op.drop_index("ix_story_snapshots_created_at", table_name="story_snapshots")
    op.drop_index("ix_story_snapshots_story_id", table_name="story_snapshots")
    op.drop_table("story_snapshots")
