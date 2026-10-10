# Import and export

Bring a draft you already have into LoreStudio, and take your manuscript out again as a file.

## Import a draft

LoreStudio reads DOCX, DOC, RTF, Markdown, plain text and ePub. It turns your headings into chapters and scenes, and shows you how before it creates anything.

1. Choose **Import** on your stories page (logo menu › **All stories**).
2. Drop in your file and pick a **Target structure template**, such as **Three-Act Structure**. Choose **Import & detect structure**.
3. **Review structure**: check each heading landed at the right level. Move a part deeper or shallower, merge it into the one before, or double-click to rename it.
4. **Extract entities**: choose **Scan with NLP** to find the characters and places named in your text. Keep the ones you want in your Lorebook, or choose **Skip**.
5. **Confirm & create**: check the title and choose **Create story**.

Your prose comes in exactly as you wrote it.

<!-- studio -->

In Studio mode, the importer can also ask the AI to find scene breaks (**Auto-segment**) and to fill in details for the characters it found. It only suggests; you choose what to keep.
<!-- /studio -->

### Scripts

A script in **Fountain** (`.fountain`, `.spmd`) or **Final Draft** (`.fdx`) comes in as a screenplay, with nothing guessed: a scene starts at each scene heading and is named for its place, `#` sections (Final Draft's New Act) become acts, and an opening `FADE IN:` stays with the first scene. Its title page, each scene's synopsis (`=` in Fountain, the scene summary in Final Draft) and its notes come with it, a note beside the line it was written on. The characters it suggests are the names in its cues, for anyone who speaks twice or more, and its places are the ones its headings name. Italics and bold are kept. Dual dialogue comes in as two speeches one after the other, and the Fountain boneyard (`/* … */`) is left out.

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
