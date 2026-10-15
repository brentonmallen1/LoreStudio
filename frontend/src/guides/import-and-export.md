# Import and export

Bring a draft you already have into LoreStudio, and take your manuscript out again as a file.

## Import a draft

LoreStudio reads DOCX, DOC, RTF, Markdown, plain text and ePub. It turns your headings into chapters and scenes, and shows you how before it creates anything.

1. Choose **Import** on your stories page (logo menu › **All stories**).
2. Drop in your file and pick a **Target structure template**, such as **Three-Act Structure**. Choose **Import & detect structure**.
3. **Review structure**: check each heading landed at the right level. Move a part deeper or shallower, merge it into the one before, or double-click to rename it. **Undo**, or {{key:undo}}, takes back each change in turn.
4. **Extract entities**: choose **Scan with NLP** to find the characters and places named in your text. Keep the ones you want in your Lorebook, or choose **Skip**.
5. **Confirm & create**: check the title and choose **Create story**.

Your prose comes in exactly as you wrote it, and every word of it lands in a scene. The text between a chapter's heading and its first scene break becomes the chapter's first scene, named for the chapter; a chapter with no breaks becomes one scene. The new story keeps a version called **As imported** (Chronicle › **Versions**).

<!-- studio -->

In Studio mode, the importer can also ask the AI to find scene breaks (**Auto-segment**) and to fill in details for the characters it found. It only suggests; you choose what to keep. Auto-segment keeps your renames, and **Undo** takes it back.
<!-- /studio -->

### Scripts

A script in **Fountain** (`.fountain`, `.spmd`) or **Final Draft** (`.fdx`) comes in as a screenplay, with nothing guessed: a scene starts at each scene heading and is named for its place, `#` sections (Final Draft's New Act) become acts, and an opening `FADE IN:` stays with the first scene. Its title page, each scene's synopsis (`=` in Fountain, the scene summary in Final Draft) and its notes come with it, a note beside the line it was written on. The characters it suggests are the names in its cues, for anyone who speaks twice or more, and its places are the ones its headings name. Italics and bold are kept. Two characters speaking at once (`^` in Fountain, dual dialogue in Final Draft) come in as speeches spoken at the same time, centred lines and lyrics as themselves, and the Fountain boneyard (`/* … */`) is left out.

### From Novelcrafter

In Novelcrafter, export the whole story (the **full** export, a `.zip`) and drop that file into the importer. Nothing is dropped without telling you:

- **The manuscript** comes in through **Review structure** as any draft does: acts, chapters, and a scene at each `* * *`. Novelcrafter's "Chapter 1: Scene 1:" numbering is taken off the titles. If it reads like a script (scene headings, character cues), **What comes over** offers to import it as a screenplay.
- **What comes over** lists every codex entry, snippet and conversation, where each will go, and a menu to send it somewhere else. Characters, places and subplots (as threads) come over with their other names, images and links. An entry such as _Richard (Physical)_ folds into Richard's appearance; one tagged _Trope_ becomes a trope in play, and one tagged _Theme_ a theme. Snippets become notes; one called _Logline_ becomes the logline, if you have none.
- **Decide later** is for anything with no clear home, such as lore. It waits in **Proposals** › **Imported**, where you make each one a character, a place, a note or anything else, keep it in the Compendium, or let it go. **Keep the rest in the Compendium** settles the lot at once, and one undo puts it back.
- **No place in LoreStudio** names what the file holds that LoreStudio has nowhere for, such as tags on characters. It is kept in the import's record. **Not in the file** lists what Novelcrafter keeps but leaves out of its export, such as scene summaries and POV: copy those across by hand.

<!-- studio -->

In Studio mode, the AI conversations come into the Chronicle, marked as from Novelcrafter. In Writer mode they stay in the file.
<!-- /studio -->

When the story is made, its report opens: Chronicle › **Imports** says what came over, what is still waiting, and what had no place, and keeps the original file to download.

## Export your manuscript

Open the **Manuscript** page and choose **Export**, or choose **Export manuscript…** in the command palette ({{key:palette}}). Pick a format and your options, then choose **Download**.

| Format              | Good for                                            |
| ------------------- | --------------------------------------------------- |
| DOCX                | Opening in Word or sharing with an editor           |
| DOCX (Manuscript)   | Standard manuscript format, for agents and editors  |
| ePub                | Reading on an e-reader                              |
| PDF                 | Printing; pick a layout such as Novel or Manuscript |
| Plain text          | Pasting into submission forms                       |
| Markdown, HTML, ODT | Other editors and the web                           |

The options:

- **Title page**, with your byline from Lorebook › **Story Identity** › **Author byline**.
- **Include act / chapter headings** and **Include scene titles**.
- **Scene break**: the mark printed between scenes.
- **Include scenes**: all of them, only revised and final, or only final.

### Screenplays

A screenplay exports as a script, not as prose. **Publish** shows its pages as they will print, and the export offers:

| Format         | Notes                                                                             |
| -------------- | --------------------------------------------------------------------------------- |
| Screenplay PDF | Industry layout: Courier 12 point, US Letter or A4, (MORE) and (CONT'D) at breaks |
| Final Draft    | `.fdx`, which opens in Final Draft, Fade In, WriterDuet and Highland              |
| Fountain       | `.fountain`, the plain-text screenplay format                                     |

Options: a title page (its credit, "based on" line, contact block, draft and date are kept with the story), scene numbers in both margins for a shooting script, bold scene headings, and (CONT'D) on a cue when the same character speaks again after action. The preview follows the options, so the pages you see are the pages that export.

> **Tip:** To move a whole story, notes and Lorebook included, to another copy of LoreStudio, download a snapshot from Chronicle › **Versions**, then choose **Import from a file…** there on the other copy. See [Snapshots, backups and undo](/guides/snapshots-and-backups).
