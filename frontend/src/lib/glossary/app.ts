import type { GlossaryEntry } from "./types";

/** LoreStudio's own words: its pages, what you meet while writing, series and safety. */

export const PARTS = [
  {
    id: "chronicle",
    term: "Chronicle",
    definition:
      "The story's history: its saved versions, every change you made (with undo) and what ran in the background.",
  },
  {
    id: "compendium",
    term: "Compendium",
    definition:
      "Your research and reference: research notes, links, documents, images and diagrams. It informs the story without being part of it.",
  },
  {
    id: "research",
    term: "Research",
    definition:
      "What you read or found for the story, kept in the Compendium: a **Research note** in your own words, a **Link** or a **Document**, each with **Why it matters** to your story.",
    alsoCalled: ["compendium entry"],
  },
  {
    id: "connections",
    term: "Connections",
    definition:
      "A map of how your story's people, places, scenes and threads link up, drawn from what you have written: logo menu › Lorebook › **Connections**.",
    alsoCalled: ["graph", "map"],
  },
  {
    id: "findings",
    term: "Findings",
    definition:
      "What the checks noticed and that may need your eye, such as an unknown speaker or a slip in point of view. Each is a question, not a verdict.",
  },
  {
    id: "lorebook",
    term: "Lorebook",
    definition:
      "Everything true in your story: its identity and intent, characters, places and how the world works.",
  },
  {
    id: "manuscript",
    term: "Manuscript",
    definition: "The prose itself, and the page where you read the book straight through and export it.",
  },
  {
    id: "plan",
    term: "Plan",
    definition:
      "The page where you work out the story before or while you write it, from an idea in a sentence to a list of scenes.",
  },
  {
    id: "promises",
    term: "Promises",
    definition:
      "What the story promises the reader and where it keeps them: threads, twists, setups and payoffs, and what the reader knows.",
  },
  {
    id: "discoveries",
    term: "Discoveries",
    definition:
      "Things LoreStudio found in your writing and won't decide without you, such as a new name or a line with no speaker. Say yes and it's added; say no and it won't ask again.",
    alsoCalled: ["proposals"],
  },
  {
    id: "story-identity",
    term: "Story Identity",
    definition: "The first page of the Lorebook: the logline, premise, themes, goals and your byline.",
  },
  {
    id: "canon",
    term: "Canon",
    definition:
      "What's true in your story. In LoreStudio, the Lorebook. In a series, canon is what the books share: the same characters, places and threads, with what stays the same and what changes from book to book.",
  },
  {
    id: "stub",
    term: "Stub",
    definition: "A name you've used that doesn't have an entry yet.",
  },
  {
    id: "codex",
    term: "Codex",
    definition:
      "The Assistant's index of your stories, named in Settings › **Codex**: the Connections map and every passage it can find by meaning. Studio mode only.",
    studio: true,
  },
] as const satisfies readonly GlossaryEntry[];

export const WRITING = [
  {
    id: "freewrite",
    term: "Freewrite",
    definition:
      "A page for loose writing, a heading for each day, with no structure to keep to. Turn what you find there into notes or characters.",
  },
  {
    id: "mention",
    term: "Mention",
    definition:
      "A name in your prose linked to the Lorebook: `@Name` for a character, `[[Name]]` for a place.",
  },
  {
    id: "note",
    term: "Note",
    definition:
      "Something to come back to: a note, a question, a to-do or an idea. It can sit in the margin beside the words it is about. A character's own are its **Notes and questions**; research goes in the Compendium.",
    alsoCalled: ["margin note"],
  },
  {
    id: "outline",
    term: "Outline",
    definition:
      "Your acts, chapters and scenes as one list, to add, rename and reorder them: logo menu › **Outline**.",
  },
  {
    id: "scene-sheet",
    term: "Scene sheet",
    definition:
      "Every field of one scene on a page: what happens, why, who, where, when, and its promises, notes and findings.",
  },
  {
    id: "why-its-here",
    term: "Why it's here",
    definition:
      "What a scene, a chapter or an act does for the story that nothing else does. It is the most useful field when you revise.",
    example:
      "Knock at the Door is where Eleanor first meets the Visitor, and lets her in against her better judgment.",
    alsoCalled: ["purpose"],
  },
  {
    id: "scratch-pad",
    term: "Scratch pad",
    definition:
      "A page that belongs to no story, kept with your account, for a thought that has nowhere to go yet.",
  },
  {
    id: "side-panel",
    term: "Side panel",
    definition:
      "The column on the right of the writing page, with tools such as **This scene**, **Characters** and **Notes**.",
  },
  {
    id: "speaker-tag",
    term: "Speaker tag",
    definition: "A name in angle brackets after a line of dialogue, `<Maya>`, saying who speaks it.",
  },
  {
    id: "status",
    term: "Status",
    definition: "Where a scene is: **Planned**, **Draft**, **Revised** or **Final**.",
  },
  {
    id: "story-strip",
    term: "The strip",
    definition:
      "The book's acts, chapters and scenes down the left of the page. Narrow, it is a line with a stop for each scene; widen it with {{key:cycleStrip}} to name every part.",
    alsoCalled: ["story strip", "the line", "the tree"],
  },
  {
    id: "starts-and-ends",
    term: "Starts and Ends",
    definition:
      "Where a scene's character or situation stands as the scene starts, and as it ends. A scene where nothing changes is worth a second look.",
    example:
      "Knock at the Door starts with Eleanor alone, set on not opening the door; it ends with the Visitor inside, drinking her tea.",
    alsoCalled: ["coming in", "going out", "the turn"],
  },
  {
    id: "this-scene",
    term: "This scene",
    definition: "The scene at a glance, in the side panel.",
  },
  {
    id: "writer-and-studio",
    term: "Writer and Studio",
    definition: "The two modes. Writer keeps to your story; Studio adds more tools.",
  },
] as const satisfies readonly GlossaryEntry[];

export const SERIES = [
  {
    id: "axis",
    term: "Axis",
    definition:
      "What changes from book to book, such as whose eyes the story is seen through, an era or a place.",
  },
  {
    id: "coming-in",
    term: "Coming in",
    definition: "What the reader knows and believes at the start of a book, from the books before it.",
  },
  {
    id: "planned-book",
    term: "Planned book",
    definition: "A book of the series you have planned but not yet written.",
  },
  {
    id: "series",
    term: "Series",
    definition: "Books that belong together, in reading order.",
  },
  {
    id: "story-so-far",
    term: "The story so far",
    definition:
      "A card for each book of a series saying what it leaves the reader with, as a reminder before the next.",
  },
] as const satisfies readonly GlossaryEntry[];

export const SAFE = [
  {
    id: "version",
    term: "Version",
    definition:
      "A saved copy of one story at one moment, to come back to: restore it, compare it or download it. Find them in Chronicle › **Versions**, each **Saved by you** or **Saved automatically**; the page's ⋯ › **Automatic versions…** sets how often LoreStudio saves one by itself.",
    alsoCalled: ["snapshot", "auto backup"],
  },
  {
    id: "backup",
    term: "Backup",
    definition:
      "A copy of all of LoreStudio, every story and setting, made on a schedule. Settings › **Versions and backups** shows the latest.",
    alsoCalled: ["database backup"],
  },
  {
    id: "undo",
    term: "Undo",
    definition:
      "{{key:undo}} takes back your last change, whether you typed it or changed something on another page.",
  },
] as const satisfies readonly GlossaryEntry[];
