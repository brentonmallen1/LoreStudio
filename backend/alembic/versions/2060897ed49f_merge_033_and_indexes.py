"""merge_033_and_indexes

Revision ID: 2060897ed49f
Revises: 033_character_classification, 92c0ea8ef898
Create Date: 2026-04-13 22:01:30.787962

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2060897ed49f'
down_revision: Union[str, None] = ('033_character_classification', '92c0ea8ef898')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
