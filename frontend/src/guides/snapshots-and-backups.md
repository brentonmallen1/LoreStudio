# Snapshots, backups and undo

Three layers protect your work.

## Undo (seconds)

**{{key:undo}} / {{key:redo}}** undo and redo changes to titles, structure, characters, relationships, locations, outlines, notes and story identity. Prose keystrokes use the editor's own history. The header shows what will be undone. Undo is per browser tab; **Chronicle › Changes** can reverse the latest change from any tab and lists everything.

## Snapshots (minutes to days)

**Versions** stores whole-story snapshots: manual ones you name, and automatic ones on the schedule in Settings › Backups. Restore always offers a safety snapshot first. Snapshots include every table the story owns and can be exported as a `.lorestudio.zip` and imported elsewhere. A version also keeps the story's numbers as they stood, for **Numbers › Compare** (see _The story in numbers_).

## Database backups (nightly)

The server copies its whole database every night into the backups folder (Settings › Backups shows the latest). To recover from a corrupted database, stop the server, replace the database file with a backup, start again.

## Local drafts

Every edit is also kept in the browser. If a save fails (server down, network gone) the pill says _Offline · retrying_ and the text is not lost; when you reopen a scene with a newer local draft, a banner offers to restore it.
