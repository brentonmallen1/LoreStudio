# Jobs: work that runs while you write

Follow, stop and switch off the work that runs in the background while you write.

## What a job is

Some work takes too long to wait for: checking the whole book, measuring it for Numbers, a backup. Each is a **job**. It runs while you write, and carries on when you change page or close the window.

<!-- studio -->

The Assistant's longer work runs as jobs too: the editorial pass, summaries of every scene, reading an import.

<!-- /studio -->

## Follow a job in the header

While a job runs, the header shows a turning ring and a count, such as "2 jobs running". A teal ring means your own machine is doing the work.

- "1 job waiting" with no ring means a job is queued and has not started.
- A job that finishes while you are elsewhere shows a note with **Open** and leaves a dot until you look. A red dot means something failed.

<!-- studio -->

The ring turns the Assistant's purple while the model is working.

<!-- /studio -->

## Open the list

Choose the header's sign, or **Show jobs** in the palette ({{key:palette}}), to open **Jobs**.

- **Running**: what each job is doing, and how far it has got.
- **Queued**: what runs next. **Run next** moves a job to the front; **Remove** takes it out.
- **While you were away** and **Earlier**: the last day's finished jobs. **Open** goes to the result, **Retry** runs a failed or stopped job again, and **Details** opens it in the Chronicle.

> **Tip:** **Show the count in the browser tab's title**, at the foot of the list, lets you see from another tab that work is running.

## Stop a job

**Stop** is the only way to end a job early. A job that works in steps finishes the step in hand first, so nothing is left half-written, and keeps what it finished.

If LoreStudio restarts mid-job, the job carries on from the front of the queue. If it is cut off a second time, it offers **Retry**.

<!-- studio -->

## Replies come first

The model answers one thing at a time, and your replies to the **Assistant** always go first. A job using the model pauses, then carries on from where it was.

- After your last reply, jobs wait a minute so a conversation is never held up between turns. **Start now** skips the wait.
- Change the wait in Settings › **AI / LLM** › **After a reply, jobs wait**.
- If your model answers several requests at once, tick **My model answers several requests at once** there. Replies and jobs then share it with no pausing.

Replies show in **Jobs** while they are written, and **Stop** ends one. Writer mode lists only local work.

<!-- /studio -->

## Automatic work

Some jobs LoreStudio does by itself:

- **Story auto-backups** and **Numbers readings** while a story is open.
- **Database backup**, a copy of everything.
- Trimming the **Undo history** and old **Automatic job records**.
- **Check for updates**, off unless you switch it on.

While one runs, the header shows it; when it finishes, it says nothing. Choose **automatic** beside it in the list to go to its settings.

<!-- studio -->

**AI call records** deletes what was sent to the model for old calls.

<!-- /studio -->

## Change what runs by itself

Settings › **Automatic work** lists every task: what it does, when it runs and when it last ran.

- Each task has a switch and its own settings, such as how often and how many to keep.
- **Run now** runs one straight away.
- One switch at the top pauses them all. Your own buttons, like **Back up now**, still work.

On a shared server, only an admin can change these.

## See jobs in the Chronicle

Chronicle › **Activity** › **Running and queued** shows the same jobs in the story's history, each with how it went.
