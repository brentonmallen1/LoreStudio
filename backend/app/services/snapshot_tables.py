"""Which tables a story snapshot holds, and under which keys.

``tests/services/test_snapshot_completeness.py`` reads these: a new story-owned table that is
in none of them fails the build, so it cannot silently fall out of backups.
"""

# Entity keys that support added/removed/modified delta tracking
_DELTA_ENTITY_KEYS = [
    "structure_nodes",
    "characters",
    "character_relationships",
    "plot_threads",
    "plot_thread_appearances",
    "twists",
    "twist_clues",
    "tropes",
    "trope_links",
    "locations",
    "scene_settings",
    "scene_presence",
    "world_systems",
    "cultures",
    "eras",
    "historical_events",
    "calendars",
    "compendium_entries",
    "outline_items",
    "settings",
    "notes",
    "diagrams",
    "interviews",
    "panel_interviews",
    "media_assets",
    "outlines",
    "scene_links",
    "todos",
    "reader_knowledge_events",
    "location_travel",
    "asset_attachments",
    "discovered_elements",
    "finding_dismissals",
    "proposal_declines",
    "dialogue_blocks",
    "compendium_attachments",
    "character_journey_summaries",
]

#: Every table that carries a ``story_id`` column, mapped to the key it is
#: serialized under. ``tests/services/test_snapshot_completeness.py`` walks
#: ``Base.metadata`` and fails if a story-owned table is missing here, so a new
#: model cannot silently fall out of backups. Tables reached through another
#: parent (character_relationships via characters, dialogue_blocks via
#: structure_nodes, ...) are listed in ``SNAPSHOT_INDIRECT_TABLES``.
SNAPSHOT_KEYS_BY_TABLE: dict[str, str] = {
    "structure_nodes": "structure_nodes",
    "characters": "characters",
    "plot_threads": "plot_threads",
    "twists": "twists",
    "tropes": "tropes",
    "locations": "locations",
    "world_systems": "world_systems",
    "cultures": "cultures",
    "eras": "eras",
    "historical_events": "historical_events",
    "calendars": "calendars",
    "settings": "settings",
    "notes": "notes",
    "compendium_entries": "compendium_entries",
    "outlines": "outlines",
    "diagrams": "diagrams",
    "panel_interviews": "panel_interviews",
    "chat_sessions": "chat_sessions",
    "activity_logs": "activity_logs",
    "story_assets": "media_assets",
    "scene_links": "scene_links",
    "reader_knowledge_events": "reader_knowledge_events",
    "discovered_elements": "discovered_elements",
    "finding_dismissals": "finding_dismissals",
    "proposal_declines": "proposal_declines",
    # What an import brought (doc 28): the record, and what still waits to be sorted.
    "import_records": "import_records",
    "imported_items": "imported_items",
}

#: Story-owned tables that have no story_id column of their own.
SNAPSHOT_INDIRECT_TABLES: dict[str, str] = {
    "character_relationships": "character_relationships",
    "character_interviews": "interviews",
    "character_journey_summaries": "character_journey_summaries",
    "plot_thread_appearances": "plot_thread_appearances",
    "twist_clues": "twist_clues",
    "trope_links": "trope_links",
    "scene_settings": "scene_settings",
    "scene_presence": "scene_presence",
    "location_travel": "location_travel",
    "outline_items": "outline_items",
    "asset_attachments": "asset_attachments",
    "compendium_attachments": "compendium_attachments",
    "dialogue_blocks": "dialogue_blocks",
    "chat_messages": "chat_sessions",  # nested inside each session
}

#: Tables deliberately not part of a snapshot: the snapshot machinery itself, the undo
#: change log, and the AI call payloads — an audit trail with its own retention, kept out
#: because restoring a snapshot should not resurrect prompts the author had pruned.
# fmt: off
SNAPSHOT_EXCLUDED_TABLES = {
    # The Codex graph is derived from everything above: restoring a snapshot and syncing
    # rebuilds it exactly, so carrying a copy would only let the two disagree.
    # A series says which rows in different books are the same thing: identity across
    # stories, not content of one. Restoring one book must not rewrite another book's links,
    # and an exported book is a standalone story; a setup that pays off in another book is a
    # link between two books, not part of either. tests/services/test_series_lifecycle.py
    # covers what the series tables do when a book is deleted or restored.
    # The Numbers readings are the book's history, not its content: restoring a version must
    # not rewind the history (doc 19); a restore adds a reading instead. They travel in an
    # export beside story.json (snapshot_export.py).
    # Kept Assistant answers (A6) are a convenience over the AI call log, not the story:
    # asking again brings one back, and a restore must not bring back one the author cleared.
    "stories", "story_snapshots", "story_backup_settings", "changes", "ai_call_payloads", "ai_jobs", "series_scene_links",
    "codex_nodes", "codex_edges", "codex_chunks", "series", "series_stories", "series_elements", "series_element_members",
    "numbers_readings", "assistant_results"}
# fmt: on
