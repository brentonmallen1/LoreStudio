import type { GlossaryEntry } from "./types";

/** LoreStudio's own words: its pages, what you meet while writing, series and safety. */

export const PARTS = [
  {
    id: "chronicle",
    term: "Chronicle",
    definition:
      "The story's history: snapshots, every change you made (with undo) and what ran in the background.",
  },
  {
    id: "compendium",
    term: "Compendium",
    definition:
      "Your research and reference: documents, links, notes, images and diagrams. It informs the story without being part of it.",
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
    id: "proposals",
    term: "Proposals",
    definition:
      "Things LoreStudio found in your prose and has not added on its own, such as a new name or a line with no speaker. You accept or dismiss each one.",
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
      "What the AI knows about your story: how its people and places connect, and an index of the prose it can search. Studio mode only.",
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
      "Something to come back to: a note, a question, a to-do or an idea. It can sit in the margin beside the words it is about.",
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
    term: "Story strip",
    definition:
      "The book's acts, chapters and scenes down the left of the page, as a line or the full Outline.",
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
      "A saved copy of the whole story at one moment, to come back to: restore it, compare it or download it. Find them in Chronicle › **Versions**. LoreStudio also saves them by itself as you work; the page's ⋯ › **Backup settings…** sets how often.",
    alsoCalled: ["snapshot"],
  },
  {
    id: "backup",
    term: "Backup",
    definition: "A copy of everything in LoreStudio, all stories included.",
  },
  {
    id: "undo",
    term: "Undo",
    definition:
      "{{key:undo}} takes back your last change, whether you typed it or changed something on another page.",
  },
] as const satisfies readonly GlossaryEntry[];
