"""panel_interview_settings

Revision ID: 17168dc53585
Revises: 036_relationship_directed_uniqueness
Create Date: 2026-04-24 15:31:03.435913

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '17168dc53585'
down_revision: Union[str, None] = '036_relationship_directed_uniqueness'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('panel_interviews', sa.Column('settings', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('panel_interviews', 'settings')
