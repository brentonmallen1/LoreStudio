import type { ShortcutId } from "../keyboard/shortcuts";
import type { StoryFormat } from "../../types";

/**
 * Every typing helper LoreStudio has, in one list (doc 26, D1): what you type, what it does,
 * where it works and the slower way it saves. The Typing guide, `?`, the slash menu, the status
 * corner's card and the tips are all drawn from here, so a helper is described once; and each
 * helper reports its first use (`markUsed`, stores/typingStore.ts), so nothing tells the writer
 * about something they already use. `helpers.test.ts` holds the list against the code.
 */

/** Where in the text a helper applies, for "What you can type here" (doc 26, surface 4). */
export type HelperContext =
  "anywhere" | "after-quote" | "selection" | "line-start" | "line-end" | "in-speech" | "in-cue";

/** What a helper is about, for the Typing guide's groups. */
export type HelperGroup = "speech" | "names" | "margin" | "commands" | "elements";

export interface TypingHelper {
  id: string;
  /** What it gives you, as the guide's line names it. */
  label: string;
  /** What you type, as written ("^", "INT. ", "Tab"). */
  typed?: string;
  /** Or the shortcut that does it, from the shortcut list, shown as keys. */
  shortcuts?: ShortcutId[];
  /** One sentence, in the app's voice. */
  does: string;
  /** The formats it works in. */
  where: StoryFormat[];
  context: HelperContext;
  group: HelperGroup;
  /** The slower route it saves, for a tip; none when there is no other way. */
  longWay?: string;
  /** The guide that says more. */
  guide: string;
}

const ALL: StoryFormat[] = ["prose", "screenplay", "stage_play"];
const SCRIPT: StoryFormat[] = ["screenplay", "stage_play"];

export const HELPERS = [
  {
    id: "line",
    label: "A line of dialogue",
    typed: "^",
    does: "Choose who speaks and type the line: LoreStudio writes the quote marks and remembers who said it.",
    where: ALL,
    context: "anywhere",
    group: "speech",
    longWay: "typing the quote marks and the speaker yourself",
    guide: "dialogue-and-quotes",
  },
  {
    id: "tag",
    label: "Who said a quote",
    typed: "<",
    does: "Straight after a closing quote mark, choose who said it.",
    where: ["prose"],
    context: "after-quote",
    group: "speech",
    longWay: "choosing the speaker in the Dialogue tool",
    guide: "dialogue-and-quotes",
  },
  {
    id: "attribute",
    label: "Words as someone's line",
    shortcuts: ["attributeDialogue"],
    does: "Select words and make them someone's line of dialogue.",
    where: ALL,
    context: "selection",
    group: "speech",
    guide: "dialogue-and-quotes",
  },
  {
    id: "mention",
    label: "Name a character",
    typed: "@",
    does: "Pick someone from the Lorebook: the name links to their sheet and counts them in the scene.",
    where: ALL,
    context: "anywhere",
    group: "names",
    longWay: "typing a name with the Lorebook open beside you",
    guide: "getting-started",
  },
  {
    id: "place",
    label: "Name a place",
    typed: "[[",
    does: "Pick a place from the Lorebook, or add a new one.",
    where: ALL,
    context: "anywhere",
    group: "names",
    guide: "getting-started",
  },
  {
    id: "slash",
    label: "Every command",
    typed: "/",
    does: "Lists everything you can add here or turn the line into; keep typing to narrow it.",
    where: ALL,
    context: "anywhere",
    group: "commands",
    guide: "getting-started",
  },
  {
    id: "note",
    label: "A note in the margin",
    typed: "/note",
    shortcuts: ["inlineNote"],
    does: "Ties a note to the sentence you are in, beside it in the margin.",
    where: ALL,
    context: "anywhere",
    group: "margin",
    longWay: "the Note button on a selection",
    guide: "notes-and-freewrite",
  },
  {
    id: "todo",
    label: "A to-do",
    typed: "/todo",
    does: "A to-do on the sentence you are in, to tick off later.",
    where: ALL,
    context: "anywhere",
    group: "margin",
    guide: "notes-and-freewrite",
  },
  {
    id: "image",
    label: "An image",
    typed: "/image",
    does: "Puts one of the story's images in the text.",
    where: ALL,
    context: "anywhere",
    group: "commands",
    longWay: "⋯ › Insert image",
    guide: "getting-started",
  },
  {
    id: "script-enter",
    label: "The next element",
    typed: "Enter",
    does: "At the end of a line, starts the element that usually comes next: a name after action, a speech after a name.",
    where: SCRIPT,
    context: "line-end",
    group: "elements",
    guide: "screenplays",
  },
  {
    id: "script-tab",
    label: "Change the element",
    typed: "Tab",
    does: "Turns the line into the next element; Shift-Tab goes back.",
    where: SCRIPT,
    context: "anywhere",
    group: "elements",
    longWay: "choosing the element from the palette",
    guide: "screenplays",
  },
  {
    id: "script-keys",
    label: "Choose an element",
    shortcuts: [
      "scriptHeading",
      "scriptAction",
      "scriptCue",
      "scriptParen",
      "scriptDialogue",
      "scriptTransition",
    ],
    does: "Makes the line a heading, action, name, parenthetical, dialogue or transition.",
    where: SCRIPT,
    context: "anywhere",
    group: "elements",
    guide: "screenplays",
  },
  {
    id: "script-heading",
    label: "A scene heading",
    typed: "INT. ",
    does: "At the start of a line, INT. or EXT. and a space make it the scene's heading.",
    where: ["screenplay"],
    context: "line-start",
    group: "elements",
    guide: "screenplays",
  },
  {
    id: "stage-marker",
    label: "A scene or act marker",
    typed: "SCENE 1 ",
    does: "At the start of a line, SCENE or ACT, a number and a space make it a marker.",
    where: ["stage_play"],
    context: "line-start",
    group: "elements",
    guide: "screenplays",
  },
  {
    id: "script-paren",
    label: "A parenthetical",
    typed: "(",
    does: "On an empty line of speech, starts a direction to the actor: (quietly).",
    where: SCRIPT,
    context: "in-speech",
    group: "elements",
    guide: "screenplays",
  },
  {
    id: "script-cue",
    label: "Names from the Lorebook",
    typed: "Tab",
    does: "On a character's line, start a name and Tab finishes it from the Lorebook.",
    where: SCRIPT,
    context: "in-cue",
    group: "elements",
    guide: "screenplays",
  },
  {
    id: "smart-type",
    label: "SmartType",
    typed: "Tab",
    does: "Places, times of day, transitions and (V.O.) are offered faintly as you type; Tab takes them.",
    where: SCRIPT,
    context: "anywhere",
    group: "elements",
    guide: "screenplays",
  },
  {
    id: "fountain-paste",
    label: "Paste a script",
    typed: "Paste",
    does: "Script text pasted in, Fountain or plain, comes in with each line as its element.",
    where: SCRIPT,
    context: "anywhere",
    group: "elements",
    guide: "screenplays",
  },
] as const satisfies readonly TypingHelper[];

export type HelperId = (typeof HELPERS)[number]["id"];

/** The helpers that work in a format. */
export function helpersFor(format: StoryFormat): TypingHelper[] {
  return (HELPERS as readonly TypingHelper[]).filter((h) => h.where.includes(format));
}

export function helper(id: HelperId): TypingHelper {
  return (HELPERS as readonly TypingHelper[]).find((h) => h.id === id)!;
}
