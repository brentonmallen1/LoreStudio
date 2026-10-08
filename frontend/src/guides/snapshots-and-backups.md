# Snapshots, backups and undo

Three layers protect your work.

## Undo (seconds)

**{{key:undo}} / {{key:redo}}** take back the last thing you did in the story, wherever you did it and wherever you are when you press them: typing in the scene, a rename, a deleted character, a moved chapter, a find and replace, converted quotes, a finding's fix. They go back in the order things happened, so typing, then a change on a sheet, then more typing, undo in that order. The header's buttons do the same and say what is next. Undo is per browser tab; **Chronicle › Changes** lists everything, can undo any one change that nothing later depends on, and can reverse the latest change from any tab.

A text field you are typing in keeps its own undo until you have typed nothing in it since you clicked in; then {{key:undo}} reaches the story's history too.

## Snapshots (minutes to days)

**Versions** stores whole-story snapshots: manual ones you name, and automatic ones on the schedule in Settings › Backups. Restore always offers a safety snapshot first. Snapshots include every table the story owns and can be exported as a `.lorestudio.zip` and imported elsewhere. A version also keeps the story's numbers as they stood, for **Numbers › Compare** (see _The story in numbers_).

## Database backups

The server copies its whole database into the backups folder every 24 hours, keeping the last 14 (Settings › Backups shows the latest; Settings › Automatic work sets how often and how many, or turns it off). To recover from a corrupted database, stop the server, replace the database file with a backup, start again.

## Local drafts

Every edit is also kept in the browser. If a save fails (server down, network gone) the pill says _Offline · retrying_ and the text is not lost; when you reopen a scene with a newer local draft, a banner offers to restore it.
