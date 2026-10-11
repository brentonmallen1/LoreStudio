import type { StoryFormat } from "../../types";
import { elementLabel, type ScriptElement } from "../script/syntax";

/**
 * What `/` offers in the editor (doc 25, P3½). Each command does something the editor already
 * does another way (a key, a picker, a menu), so a writer who reaches for `/` finds it. In a
 * script it also sets the line's element, named the way the story's format names it.
 */
export type SlashAction =
  | { kind: "dialogue" }
  | { kind: "note" }
  | { kind: "todo" }
  | { kind: "image" }
  /** Type the characters that open a picker: `@` for a character, `[[` for a place. */
  | { kind: "type"; text: string }
  | { kind: "element"; el: ScriptElement }
  | { kind: "together" };

export interface SlashCommandDef {
  name: string;
  label: string;
  description: string;
  /** Other words it answers to, `/speech` for /dialogue. */
  keywords: string[];
  action: SlashAction;
}

const DIALOGUE: SlashCommandDef = {
  name: "dialogue",
  label: "A line of dialogue",
  description: "Pick who speaks, then type what they say",
  keywords: ["speech", "say", "line", "speaker", "quote"],
  action: { kind: "dialogue" },
};

const SHARED: SlashCommandDef[] = [
  {
    name: "note",
    label: "Add a note",
    description: "A note in the margin, on the sentence at the cursor",
    keywords: ["comment", "margin", "remark"],
    action: { kind: "note" },
  },
  {
    name: "todo",
    label: "Add a to-do",
    description: "A to-do in the margin, on the sentence at the cursor",
    keywords: ["task", "fix", "later", "margin"],
    action: { kind: "todo" },
  },
  {
    name: "image",
    label: "Insert an image",
    description: "A picture from the story's images, here in the text",
    keywords: ["picture", "photo", "media", "figure"],
    action: { kind: "image" },
  },
  {
    name: "place",
    label: "Link a place",
    description: "Pick a place from the Lorebook, as [[ does",
    keywords: ["location", "setting", "where"],
    action: { kind: "type", text: "[[" },
  },
];

const MENTION = {
  label: "Mention a character",
  description: "Pick a character from the Lorebook, as @ does",
  keywords: ["mention", "person", "who", "name"],
  action: { kind: "type", text: "@" } as SlashAction,
};

/** A script's elements, in the order a scene usually runs. */
const ELEMENTS: [string, ScriptElement, string[], string][] = [
  [
    "heading",
    "heading",
    ["scene", "slugline", "int", "ext", "act", "location"],
    "Where and when the scene happens",
  ],
  ["action", "action", ["description", "direction", "stage", "see"], "What we see happen"],
  ["character", "cue", ["cue", "name", "speaker", "who"], "The name of who speaks next"],
  ["parenthetical", "paren", ["wryly", "beat", "direction", "how"], "How the next line is said"],
  ["transition", "transition", ["cut", "fade", "dissolve"], "CUT TO:, FADE OUT. and the like"],
  ["centred", "centered", ["centered", "middle", "title", "end"], "A line centred on the page"],
  ["lyric", "lyric", ["song", "sing", "verse"], "Words sung, in italics"],
];

export function slashCommandsFor(format: StoryFormat): SlashCommandDef[] {
  if (format === "prose") return [DIALOGUE, { name: "character", ...MENTION }, ...SHARED];
  const elements = ELEMENTS.map(([name, el, keywords, description]) => ({
    name,
    label: elementLabel(el, format),
    description,
    keywords,
    action: { kind: "element", el } as SlashAction,
  }));
  return [
    ...elements,
    DIALOGUE,
    {
      name: "together",
      label: "Speak at the same time",
      description: "This speech and the one before it, side by side",
      keywords: ["dual", "same", "overlap", "both", "simultaneous"],
      action: { kind: "together" },
    },
    { name: "mention", ...MENTION },
    ...SHARED,
  ];
}

/** The commands a query after `/` reaches: by name first, then by a word of the label or a
 *  keyword, each command once. */
export function matchSlash(commands: SlashCommandDef[], query: string): SlashCommandDef[] {
  const q = query.toLowerCase();
  const byName = commands.filter((c) => c.name.startsWith(q));
  const byWord = commands.filter(
    (c) =>
      !byName.includes(c) &&
      [...c.label.toLowerCase().split(/[^a-z]+/), ...c.keywords].some((w) => w.startsWith(q)),
  );
  return [...byName, ...byWord];
}
