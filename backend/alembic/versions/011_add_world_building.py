"""Add world building tables

Revision ID: 011
Revises: 010
Create Date: 2026-04-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Locations (hierarchical)
    op.create_table(
        "locations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), sa.ForeignKey("stories.id"), nullable=False),
        sa.Column("parent_id", sa.String(), sa.ForeignKey("locations.id"), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("location_type", sa.String(), nullable=False, server_default=""),
        sa.Column("climate", sa.String(), nullable=False, server_default=""),
        sa.Column("terrain", sa.Text(), nullable=False, server_default=""),
        sa.Column("political_affiliation", sa.String(), nullable=False, server_default=""),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("atmosphere", sa.Text(), nullable=False, server_default=""),
        sa.Column("history", sa.Text(), nullable=False, server_default=""),
        sa.Column("significance", sa.Text(), nullable=False, server_default=""),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Scene settings junction (location <-> structure node)
    op.create_table(
        "scene_settings",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("location_id", sa.String(), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("node_id", sa.String(), sa.ForeignKey("structure_nodes.id"), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="primary"),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # World systems (magic, technology, powers, etc.)
    op.create_table(
        "world_systems",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), sa.ForeignKey("stories.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("system_type", sa.String(), nullable=False, server_default=""),
        sa.Column("source_origin", sa.Text(), nullable=False, server_default=""),
        sa.Column("rules", sa.Text(), nullable=False, server_default=""),
        sa.Column("limitations", sa.Text(), nullable=False, server_default=""),
        sa.Column("costs", sa.Text(), nullable=False, server_default=""),
        sa.Column("hierarchy_tiers", sa.JSON(), nullable=True, server_default="[]"),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Cultures / societies
    op.create_table(
        "cultures",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), sa.ForeignKey("stories.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("values", sa.Text(), nullable=False, server_default=""),
        sa.Column("customs", sa.Text(), nullable=False, server_default=""),
        sa.Column("taboos", sa.Text(), nullable=False, server_default=""),
        sa.Column("religion", sa.Text(), nullable=False, server_default=""),
        sa.Column("government_type", sa.String(), nullable=False, server_default=""),
        sa.Column("economy", sa.Text(), nullable=False, server_default=""),
        sa.Column("social_hierarchy", sa.Text(), nullable=False, server_default=""),
        sa.Column("naming_conventions", sa.JSON(), nullable=True, server_default="{}"),
        sa.Column("common_phrases", sa.JSON(), nullable=True, server_default="[]"),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Eras (historical periods)
    op.create_table(
        "eras",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), sa.ForeignKey("stories.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("start_date", sa.String(), nullable=False, server_default=""),
        sa.Column("end_date", sa.String(), nullable=False, server_default=""),
        sa.Column("characteristics", sa.Text(), nullable=False, server_default=""),
        sa.Column("key_figures", sa.JSON(), nullable=True, server_default="[]"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Historical events
    op.create_table(
        "historical_events",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), sa.ForeignKey("stories.id"), nullable=False),
        sa.Column("era_id", sa.String(), sa.ForeignKey("eras.id"), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("in_world_date", sa.String(), nullable=False, server_default=""),
        sa.Column("participants", sa.JSON(), nullable=True, server_default="[]"),
        sa.Column("causes", sa.Text(), nullable=False, server_default=""),
        sa.Column("consequences", sa.Text(), nullable=False, server_default=""),
        sa.Column("legacy_effects", sa.Text(), nullable=False, server_default=""),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Location travel distances
    op.create_table(
        "location_travel",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("from_location_id", sa.String(), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("to_location_id", sa.String(), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("travel_time", sa.String(), nullable=False, server_default=""),
        sa.Column("travel_method", sa.String(), nullable=False, server_default=""),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("bidirectional", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Calendars
    op.create_table(
        "calendars",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("story_id", sa.String(), sa.ForeignKey("stories.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("months", sa.JSON(), nullable=True, server_default="[]"),
        sa.Column("days_per_week", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("week_day_names", sa.JSON(), nullable=True, server_default="[]"),
        sa.Column("special_days", sa.JSON(), nullable=True, server_default="[]"),
        sa.Column("epoch_name", sa.String(), nullable=False, server_default=""),
        sa.Column("conversion_notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("calendars")
    op.drop_table("location_travel")
    op.drop_table("historical_events")
    op.drop_table("eras")
    op.drop_table("cultures")
    op.drop_table("world_systems")
    op.drop_table("scene_settings")
    op.drop_table("locations")
