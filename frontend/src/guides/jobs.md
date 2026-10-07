# Jobs: work that runs while you write

Some work takes longer than you should have to wait for: a check over the whole book, the editorial pass, summaries of every scene, measuring the book, reading an import. Each is a **job**. It runs on its own while you keep writing, carries on when you go to another page or close the window, and stops only when you say so.

## At the top of the page

While a job runs, the header says so: a turning ring and "2 jobs running". The ring is the Assistant's colour while the model is working and teal while the work is local (spaCy, the Codex sync, a measurement), which never needs a model and never leaves your machine. "1 job waiting" with no ring means a job is queued but has not started (see **Replies first**).

When something finishes while you are elsewhere, a small note appears with **Open**, and the header keeps a dot until you look. A red dot means something failed. When nothing is running and nothing is new, the header shows nothing at all.

## The list

Choose the header's sign, or **Show jobs** in the palette ({{key:palette}}), to open **Jobs**:

- **Running**: what each job is doing now, how far it has got ("12 of 31"), and, once two steps have shown how long a step takes, about how long is left. **Stop** ends it. A check stops at once. Work in steps (the editorial pass, the summaries) finishes the step in hand, so nothing is left half-written, and keeps what it finished: a pass stopped after two of its five analyses still has a report.
- **Queued**: what runs next, in order. **Run next** moves a job to the front; **Remove** takes it out.
- **While you were away**, then **Earlier**: the last day's finished jobs, each with **Open** (where its result is: Findings for a check, the report for a pass, Numbers for a measurement), **Retry** for one that failed or was stopped, and **Details**, which opens it in the Chronicle with every call it made.

The Assistant's replies and summaries are listed too while they are being written, by name ("Character Interview · Eleanor"), from whichever window they started in, a popped-out panel included. **Stop** on one ends it from any window, keeping what was written so far.

A failure is said plainly. "The model is not running. Start Ollama, then Retry." is the usual one.

## Replies first

There is one model, and it answers one thing at a time. When you ask the Assistant something (an interview, a chat, a summary) while a job is using the model, your reply goes first: the job's call stops, and the job goes back to the front of the queue, to carry on from where it was. The Chronicle shows that call as "Made way for a reply".

After your last reply the model's jobs wait a minute before starting again, so a conversation is never held up between turns. The job says so: "Waiting: Character Interview · Eleanor goes first" while the reply runs, then "Waiting: starts 40 s after your last reply". **Start now** skips the wait for that job. You can change how long it waits, or turn the wait off, under Settings › AI.

If the model is not answering, or you have switched AI off, the jobs wait instead of failing one after another, and **Try now** tries again.

## Leaving and coming back

- **Going to another page** never stops anything. Coming back to Findings shows a check still running.
- **Closing the window** does not stop a job, and a summary or a reply that is being written finishes and is saved. **Stop** is the only way to end either early.
- **Closing the import** while the Assistant reads the people and places in it loses nothing: opening the import again goes back to that step and picks the result up.
- **If LoreStudio restarts** mid-job, the job goes back to the front of the queue once and carries on. If it is interrupted again, it fails and offers **Retry**.

## Writer mode

Writer mode lists local work only: the local checks, measurements, the Codex sync. A job the Assistant was doing when you switched carries on out of sight, and shows, finished, when you come back to Studio.

## Automatic work

Some jobs you did not ask for: the reading Numbers takes when you open a story after a few hours away or with a version you save, the database backup, and the tidying of old records (the undo history, what was sent to the model, old automatic jobs). While one runs, the header shows it like any other job, since it is your computer doing the work. Its finishing is **quiet**: it is listed, marked "automatic" and in the Chronicle, but never a note on screen or a dot in the header.

**Settings › Automatic work** lists all of it: what each does, when it runs, when it last ran and what it did. Each has a switch and its own settings (how often, how many to keep), and one switch pauses them all. Choosing "automatic" on a job opens it.

## In the Chronicle

Chronicle › Activity › **Running and queued** shows the same jobs in the story's history. Every job is a row there, and opens onto the calls it made: what was sent to the model and what came back.

## The tab title

At the foot of the list, **Show the count in the browser tab's title** puts "(2)" before the page's name, so you can see from another tab that work is running. It is off unless you turn it on.
