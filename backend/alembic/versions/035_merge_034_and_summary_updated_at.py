"""merge 034_extend_character_relationships and 834a36e69b30

Revision ID: 035_merge_relationship_extensions
Revises: 034_extend_character_relationships, 834a36e69b30
Create Date: 2026-04-18
"""
from typing import Sequence, Union

revision: str = "035_merge_relationship_extensions"
down_revision: Union[str, tuple[str, ...], None] = ("034_extend_character_relationships", "834a36e69b30")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
