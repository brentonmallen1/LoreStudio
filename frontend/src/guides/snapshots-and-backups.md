# Snapshots, backups and undo

Three layers keep your work safe: undo, versions of each story, and backups of everything.

## Undo

{{key:undo}} takes back the last thing you did, and {{key:redo}} puts it back. It covers typing, renames, deleted characters, moved chapters and fixed findings, in the order you did them.

> **Tip:** Logo menu › **Chronicle** › **Changes** lists every change. Undo any one there, as long as nothing later depends on it.

## Versions

A version is a snapshot of the whole story. Open logo menu › **Chronicle** › **Versions**.

- **Create snapshot** saves one now, under a name like "Draft 1".
- Automatic snapshots run on a schedule: the page's ⋯ › **Backup settings…**.
- **Restore to this version** brings the story back, saving it as it is first.
- **Download snapshot** saves a version as a file; **Import from a file…** brings one back.

## Database backups

LoreStudio copies its whole database to a backups folder: every 24 hours, keeping the last 14. It also takes a copy before any update changes the database.

Settings › **Backups** shows the latest copy and the folder; Settings › **Automatic work** sets the schedule. To recover, stop LoreStudio, replace the database file with a backup, and start it again.

## If a save fails

Your words are also kept in the browser. If the light in the status corner turns red, nothing is lost: reopen the scene and choose **Restore draft**.
