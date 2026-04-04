"""Add celestial fields to locations and condition to location_travel

Revision ID: 012
Revises: 011
Create Date: 2026-04-04
"""
from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("locations", sa.Column("orbital_period", sa.String(), nullable=True, server_default=""))
    op.add_column("locations", sa.Column("distance_from_parent", sa.String(), nullable=True, server_default=""))
    op.add_column("locations", sa.Column("gravity", sa.String(), nullable=True, server_default=""))
    op.add_column("locations", sa.Column("habitability", sa.String(), nullable=True, server_default=""))
    op.add_column("locations", sa.Column("radiation_level", sa.String(), nullable=True, server_default=""))
    op.add_column("location_travel", sa.Column("condition", sa.String(), nullable=True, server_default=""))


def downgrade() -> None:
    op.drop_column("locations", "orbital_period")
    op.drop_column("locations", "distance_from_parent")
    op.drop_column("locations", "gravity")
    op.drop_column("locations", "habitability")
    op.drop_column("locations", "radiation_level")
    op.drop_column("location_travel", "condition")
