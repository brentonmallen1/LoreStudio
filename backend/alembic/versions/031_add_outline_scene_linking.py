"""add outline scene linking

Revision ID: 031_add_outline_scene_linking
Revises: ea6e72c68686
Create Date: 2026-04-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "031_add_outline_scene_linking"
down_revision: Union[str, None] = "ea6e72c68686"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("outline_items", sa.Column("scene_id", sa.String(), nullable=True))
    op.add_column("outline_items", sa.Column("scene_title", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("outline_items", "scene_title")
    op.drop_column("outline_items", "scene_id")
