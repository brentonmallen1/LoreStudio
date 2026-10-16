import type { EmptyStateCopy } from "../components/common/EmptyState";

/**
 * The words of every empty page (doc 30 D3), in one place so they read as one voice: what it
 * is, why it helps the writing, the quicker way in, an example from The Last Lighthouse and
 * the guide. The page supplies its own button. Writer mode reads these too, so none of them
 * leans on the Assistant.
 */
export const EMPTY = {
  characters: {
    title: "Who is in your story?",
    what: "Keep the people of your story here: what they want, what they're hiding, who they love.",
    why: "When you come back after a month, or reach chapter twenty, you won't have to reread to remember their eye color or their sister's name.",
    example: {
      name: "Eleanor Vance",
      text: ", the keeper. Wants to keep the light running alone; needs to face what her father did.",
    },
    quicker: "Or type `@` and a new name while you write.",
    guide: { id: "who-are-they", label: "How to write people" },
  },
  places: {
    title: "Where does your story happen?",
    what: "Keep its places here, from a whole island to one room, and what it feels like to be in each.",
    why: "A place you've described once stays the same every time you come back to it, down to the creak of the stairs.",
    example: {
      name: "Harrow Island",
      text: ", which holds The Lighthouse, the Keeper's Cottage, The Shoals and The Village.",
    },
    quicker: "Or type `[[` and a new name while you write.",
    guide: { id: "lorebook", label: "How the Lorebook works" },
  },
  systems: {
    title: "The rules your world runs on",
    what: "Magic, technology, faith, trade: anything with rules your story has to keep.",
    why: "Write a rule down once and you'll notice when a scene breaks it.",
    example: { name: "The Light", text: ": it must be on by dusk, and must not go out before dawn." },
    guide: { id: "lorebook", label: "How the Lorebook works" },
  },
  cultures: {
    title: "The groups your people belong to",
    what: "What they value, what they do together, and what they would never do.",
    why: "Characters from the same place share habits without being the same person; this is where those habits live.",
    example: { name: "Islanders", text: ": storm preparation is communal and wordless, and no one knocks." },
    guide: { id: "lorebook", label: "How the Lorebook works" },
  },
  history: {
    title: "What happened before page one",
    what: "Eras, and the events in them, each with its date.",
    why: "The past your characters carry stays consistent from scene to scene, even when the story only hints at it.",
    example: { name: "The Great Storm", text: ", November 1962, in The Keeper's Era." },
    guide: { id: "lorebook", label: "How the Lorebook works" },
  },
  calendars: {
    title: "How your people count their days",
    what: "Months, seasons and the days in them, when your world doesn't use ours, or uses it its own way.",
    why: "Dates in your story add up when the calendar is written down.",
    example: { name: "Atlantic Season Calendar", text: ": time kept in weather logs and fishing records." },
    guide: { id: "lorebook", label: "How the Lorebook works" },
  },
  travel: {
    title: "How long it takes to get there",
    what: "The routes between your places: how long each takes, how, and what can stop you.",
    why: "No one crosses the island in five minutes in one chapter and an hour in the next.",
    example: { name: "Harrow Island to The Lighthouse", text: ": 20 minutes on foot, along the cliff edge." },
    guide: { id: "lorebook", label: "How the Lorebook works" },
  },
  threads: {
    title: "What questions does your story open?",
    what: "A thread is a question your story opens and must close: a mystery, a journey, a change in someone.",
    why: "Keeping them in one place shows which you've answered and which you've left hanging.",
    example: { name: "The Missing Logs", text: ": what happened to six months of entries?" },
    guide: { id: "promises", label: "How threads work" },
  },
  compendium: {
    title: "Your research shelf",
    what: "Articles, notes, pictures and files you're reading to write this story. They inform it without being part of it.",
    why: "The Lorebook is what's true in your story. The Compendium is what's true in the world you borrowed from.",
    example: {
      name: "Lighthouse Keeper Duties & History",
      text: ": what a keeper did each night, and why the logbooks matter.",
    },
    guide: { id: "compendium", label: "How the Compendium works" },
  },
  versions: {
    title: "Saved versions of your story",
    what: "A version is a copy of the whole story as it is right now, so you can come back to it.",
    why: "Save one before a big rewrite. If the new draft goes wrong, nothing is lost. LoreStudio also saves one by itself now and then as you work.",
    example: { name: "Before rewriting The Gap", text: ", saved the morning you start again." },
    guide: { id: "snapshots-and-backups", label: "Versions and backups" },
  },
  summaries: {
    title: "Each scene in a few lines",
    what: "A scene's summary says what happens in it, so you can see the whole story at a glance.",
    why: "Reading every summary in order is the quickest way to find a gap, a repeat or a scene that does nothing.",
    example: {
      name: "The Gap",
      text: ": Eleanor finds six months of log entries missing. The Visitor is not surprised.",
    },
    guide: { id: "structure", label: "How scenes and chapters work" },
  },
  storyboard: {
    title: "Your scenes as cards",
    what: "Every scene of the book as a card on a board, in reading order.",
    why: "Seeing the whole book at once shows where it drags and where it rushes, and moving a card moves the scene.",
    example: {
      name: "Knock at the Door",
      text: ": Eleanor opens the door to find the Visitor standing in the rain.",
    },
    guide: { id: "structure", label: "How scenes and chapters work" },
  },
  manuscript: {
    title: "Nothing to read yet",
    what: "The manuscript is the whole story as one document, scene after scene, ready to read through or export.",
    why: "Reading it straight through, as a reader would, is how you hear the book's rhythm.",
    guide: { id: "import-and-export", label: "How reading and export work" },
  },
  connections: {
    title: "How everything links up",
    what: "A map of who and what your story ties together, drawn from what you've already written. Nothing on it is invented.",
    why: "It shows who is tied to what, and what stands alone that maybe shouldn't.",
    example: {
      name: "The Visitor Has Been Here Before",
      text: ": a twist hinted at in three scenes and revealed in What Thomas Knew.",
    },
    guide: { id: "connections", label: "How Connections works" },
  },
  changes: {
    title: "Every change, kept",
    what: "Each change you make to the story is listed here, newest first: a rename, a moved chapter, a fixed finding.",
    why: "Any of them can be taken back, even one from days ago, as long as nothing later depends on it.",
    guide: { id: "snapshots-and-backups", label: "Undo, versions and backups" },
  },
  // Notes and Discoveries were already good (doc 30's audit): their words, on the component.
  notes: {
    title: "No notes yet",
    what: "Select words in a scene to leave one beside them, or write one here and tie it later.",
    guide: { id: "notes-and-freewrite", label: "How notes work" },
  },
  discoveries: {
    title: "Nothing waiting",
    what: "When the prose names someone or somewhere the Lorebook does not have, or a line of dialogue has no speaker, it waits here for a yes or a no.",
    guide: { id: "discoveries", label: "How Discoveries works" },
  },
} satisfies Record<string, EmptyStateCopy>;
