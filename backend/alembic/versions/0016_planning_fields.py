"""One set of planning fields, whatever the method (doc 10 P1)

The Snowflake tab kept its own copies of what Story Identity and the character sheet
already hold, so the same story had two loglines that drifted apart. Every planning method
now writes the same fields:

- stories.snowflake_sentence  → stories.logline. When both hold different text, the
  sentence is kept in a story note ("From the Snowflake tab") rather than dropped.
- stories.snowflake_paragraph → stories.paragraph_summary
- stories.snowflake_synopsis  → stories.synopsis
- characters.snowflake_summary → mission_statement (goal), motivation, and the new
  conflict and epiphany columns. Text written as "Goal: … Motivation: … Conflict: …
  Epiphany: …" is split; each part fills its field when that field is empty. Whatever
  cannot be placed is appended to arc_notes, so nothing is lost.
- characters.snowflake_synopsis → characters.arc_in_own_words
- stories.planning_method: the method the author is following on the Plan page ("" = none
  chosen yet), so the Overview can name the next step.

Revision ID: 0016_planning_fields
Revises: 0015_character_flaws_quirks_speech
"""

import json
import re
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "0016_planning_fields"
down_revision: str | None = "0015_character_flaws_quirks_speech"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

GMC_LABELS = ("goal", "motivation", "conflict", "epiphany")
_LABEL_RE = re.compile(r"\b(goal|motivation|conflict|epiphany)\s*:\s*", re.IGNORECASE)


def split_gmc(text: str) -> dict[str, str] | None:
    """Split "Goal: … Motivation: … Conflict: … Epiphany: …" into its parts.

    Returns None when the text does not start with one of the labels, so free-form
    summaries are kept whole instead of being cut at a stray "conflict:" mid-sentence.
    """
    text = text.strip()
    matches = list(_LABEL_RE.finditer(text))
    if not matches or matches[0].start() != 0:
        return None
    parts: dict[str, str] = {}
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        key = m.group(1).lower()
        value = text[m.end() : end].strip()
        if value and key not in parts:
            parts[key] = value[0].upper() + value[1:]
    return parts


GMC_TARGETS = {"goal": "mission_statement", "motivation": "motivation", "conflict": "conflict", "epiphany": "epiphany"}


def place_summary(summary: str, fields: dict[str, str]) -> dict[str, str]:
    """The character columns to write for a Snowflake summary, given the current ones."""
    summary = summary.strip()
    if not summary:
        return {}
    updates: dict[str, str] = {}
    leftover: list[str] = []
    parts = split_gmc(summary)
    if parts is None:
        leftover.append(summary)
    else:
        for key, value in parts.items():
            column = GMC_TARGETS[key]
            current = (fields.get(column) or "").strip()
            if not current:
                updates[column] = value
            elif current != value:
                leftover.append(f"{key.capitalize()}: {value}")
    if leftover:
        notes = (fields.get("arc_notes") or "").rstrip()
        block = "From the Snowflake summary:\n" + "\n".join(leftover)
        updates["arc_notes"] = f"{notes}\n\n{block}" if notes else block
    return updates


def _drop_columns(table: str, *columns: str) -> None:
    # Native DROP COLUMN (SQLite 3.35+). A batch rebuild would drop and recreate the table,
    # which foreign_keys=ON refuses for stories and characters while other rows point at them.
    for column in columns:
        op.execute(f"ALTER TABLE {table} DROP COLUMN {column}")


def upgrade() -> None:
    conn = op.get_bind()

    with op.batch_alter_table("stories", schema=None) as batch_op:
        batch_op.add_column(sa.Column("paragraph_summary", sa.Text(), server_default="", nullable=False))
        batch_op.add_column(sa.Column("synopsis", sa.Text(), server_default="", nullable=False))
        batch_op.add_column(sa.Column("planning_method", sa.String(), server_default="", nullable=False))
    with op.batch_alter_table("characters", schema=None) as batch_op:
        batch_op.add_column(sa.Column("conflict", sa.Text(), server_default="", nullable=False))
        batch_op.add_column(sa.Column("epiphany", sa.Text(), server_default="", nullable=False))
        batch_op.add_column(sa.Column("arc_in_own_words", sa.Text(), server_default="", nullable=False))

    # The format SQLAlchemy writes for DateTime on SQLite, so the ORM reads it back.
    now = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S.%f")
    stories = conn.execute(
        sa.text("SELECT id, logline, snowflake_sentence, snowflake_paragraph, snowflake_synopsis FROM stories")
    ).fetchall()
    for sid, logline, sentence, paragraph, synopsis in stories:
        sentence = (sentence or "").strip()
        values = {"id": sid, "paragraph": paragraph or "", "synopsis": synopsis or "", "logline": logline or ""}
        if sentence and not values["logline"].strip():
            values["logline"] = sentence
        elif sentence and sentence != values["logline"].strip():
            conn.execute(
                sa.text(
                    "INSERT INTO story_notes (id, story_id, title, content, category, tags, created_at, updated_at) "
                    "VALUES (:id, :story_id, :title, :content, 'ideas', :tags, :now, :now)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "story_id": sid,
                    "title": "From the Snowflake tab",
                    "content": f"One-sentence summary:\n\n{sentence}",
                    "tags": json.dumps([]),
                    "now": now,
                },
            )
        conn.execute(
            sa.text(
                "UPDATE stories SET logline = :logline, paragraph_summary = :paragraph, synopsis = :synopsis "
                "WHERE id = :id"
            ),
            values,
        )

    characters = conn.execute(
        sa.text(
            "SELECT id, snowflake_summary, snowflake_synopsis, mission_statement, motivation, arc_notes "
            "FROM characters"
        )
    ).fetchall()
    for cid, summary, own_words, mission, motivation, arc_notes in characters:
        fields = {"mission_statement": mission or "", "motivation": motivation or "", "arc_notes": arc_notes or ""}
        updates = place_summary(summary or "", fields)
        updates["arc_in_own_words"] = own_words or ""
        assignments = ", ".join(f"{column} = :{column}" for column in updates)
        conn.execute(sa.text(f"UPDATE characters SET {assignments} WHERE id = :id"), {**updates, "id": cid})

    _drop_columns("stories", "snowflake_sentence", "snowflake_paragraph", "snowflake_synopsis")
    _drop_columns("characters", "snowflake_summary", "snowflake_synopsis")


def downgrade() -> None:
    conn = op.get_bind()
    with op.batch_alter_table("stories", schema=None) as batch_op:
        batch_op.add_column(sa.Column("snowflake_sentence", sa.Text(), server_default="", nullable=False))
        batch_op.add_column(sa.Column("snowflake_paragraph", sa.Text(), server_default="", nullable=False))
        batch_op.add_column(sa.Column("snowflake_synopsis", sa.Text(), server_default="", nullable=False))
    with op.batch_alter_table("characters", schema=None) as batch_op:
        batch_op.add_column(sa.Column("snowflake_summary", sa.Text(), server_default="", nullable=False))
        batch_op.add_column(sa.Column("snowflake_synopsis", sa.Text(), server_default="", nullable=False))

    conn.execute(
        sa.text(
            "UPDATE stories SET snowflake_sentence = logline, snowflake_paragraph = paragraph_summary, "
            "snowflake_synopsis = synopsis"
        )
    )
    for cid, mission, motivation, conflict, epiphany, own_words in conn.execute(
        sa.text("SELECT id, mission_statement, motivation, conflict, epiphany, arc_in_own_words FROM characters")
    ).fetchall():
        values = dict(zip(GMC_LABELS, (mission, motivation, conflict, epiphany), strict=True))
        summary = " ".join(f"{k.capitalize()}: {v.strip()}" for k, v in values.items() if (v or "").strip())
        conn.execute(
            sa.text("UPDATE characters SET snowflake_summary = :s, snowflake_synopsis = :o WHERE id = :id"),
            {"s": summary, "o": own_words or "", "id": cid},
        )

    _drop_columns("characters", "arc_in_own_words", "epiphany", "conflict")
    _drop_columns("stories", "planning_method", "synopsis", "paragraph_summary")
