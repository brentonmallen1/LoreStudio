import { Extension, InputRule } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { Fragment, Slice, type Node as PMNode, type Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";
import { editorKey, SHORTCUTS } from "../../../lib/keyboard/shortcuts";
import { readerText } from "../../../lib/prose/syntax";
import { mentionIsOpen } from "../../story/MentionDropdown";
import { slashIsOpen } from "../../story/SlashCommandExtension";
import {
  CAPITALS,
  classifyLine,
  ENTER_NEXT,
  headingAt,
  isElement,
  parseLines,
  SHIFT_TAB_NEXT,
  TAB_NEXT,
  type ScriptElement,
} from "../../../lib/script/syntax";

/**
 * A screenplay in the editor (doc 25). Every block is one element (scene heading, action,
 * cue, parenthetical, dialogue, transition), kept on the paragraph as `data-el`.
 *
 * `ScriptElementAttribute` is in every editor, so a story switched from script to prose and
 * back keeps its elements. `ScriptKeys` joins only for a script, and is all extras (D2, D6):
 * the author writes the way they write prose — `^` for a line, a plain paragraph for action —
 * and these are for hands that know Final Draft: Enter moves on to the element that usually
 * comes next, Tab turns the line into another element, typing `INT. ` starts a heading, an
 * ALL CAPS name with Enter becomes a cue, `(` in an empty line of speech a parenthetical,
 * and pasted Fountain text arrives as elements.
 */
export const ScriptElementAttribute = Extension.create({
  name: "scriptElementAttribute",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          el: {
            default: null,
            keepOnSplit: true,
            parseHTML: (element: HTMLElement) => {
              const el = element.getAttribute("data-el");
              return isElement(el) ? el : null;
            },
            renderHTML: (attrs: { el?: string | null }) => (attrs.el ? { "data-el": attrs.el } : {}),
          },
        },
      },
    ];
  },
});

/** The element of the block the cursor is in; a paragraph with none is action. */
export function elementAt(state: EditorState): ScriptElement {
  const el = state.selection.$from.parent.attrs.el;
  return isElement(el) ? el : "action";
}

function blockStart(state: EditorState): number {
  return state.selection.$from.before();
}

/** Turn the block at `pos` into `el`, putting its words in capitals if `el` takes them. */
export function setElementAt(tr: Transaction, pos: number, el: ScriptElement): Transaction {
  const node = tr.doc.nodeAt(pos);
  if (!node || node.type.name !== "paragraph") return tr;
  tr.setNodeMarkup(pos, undefined, { ...node.attrs, el });
  if (CAPITALS.includes(el)) capitalise(tr, pos, node);
  return tr;
}

function capitalise(tr: Transaction, pos: number, node: PMNode): void {
  const texts: { at: number; node: PMNode }[] = [];
  node.descendants((child, offset) => {
    if (child.isText && child.text && child.text !== child.text.toUpperCase())
      texts.push({ at: pos + 1 + offset, node: child });
  });
  for (const { at, node: child } of texts.reverse()) {
    const upper = child.type.schema.text(child.text!.toUpperCase(), child.marks);
    tr.replaceWith(at, at + child.nodeSize, upper);
  }
}

/** The index of the scene's own heading: its first line, or the first after "FADE IN:". */
function ownHeading(doc: PMNode): number {
  const blocks: [string | null, string][] = [];
  doc.forEach((node) => blocks.push([(node.attrs.el as string | null) ?? null, node.textContent]));
  return headingAt(blocks);
}

/** Where the cursor's heading starts, when it is a heading below the scene's own. */
export function headingBelowTop(editor: Editor): number | null {
  const { $from } = editor.state.selection;
  if ($from.depth < 1 || $from.index(0) <= ownHeading(editor.state.doc)) return null;
  return $from.node(1).attrs.el === "heading" ? $from.before(1) : null;
}

/** Where each heading below the scene's own starts: each starts another scene (several pasted). */
export function headingsBelowTop(doc: PMNode): number[] {
  const own = ownHeading(doc);
  const out: number[] = [];
  doc.forEach((node, offset, index) => {
    if (index > own && node.attrs.el === "heading") out.push(offset);
  });
  return out;
}

/** Set the element of the block the cursor is in (the palette, ⌥⌘1–6, Tab). */
export function setElement(editor: Editor, el: ScriptElement): boolean {
  const { state } = editor;
  if (state.selection.$from.parent.type.name !== "paragraph") return false;
  editor.view.dispatch(setElementAt(state.tr, blockStart(state), el));
  return true;
}

/** What the words of an action line say they are, typed Fountain-style. */
function typedAs(text: string): ScriptElement | null {
  const el = classifyLine(text, null);
  return el === "heading" || el === "cue" || el === "transition" ? el : null;
}

function enter(editor: Editor): boolean {
  const { state, view } = editor;
  const { $from, empty } = state.selection;
  const block = $from.parent;
  if (!empty || block.type.name !== "paragraph") return false;
  const el = elementAt(state);
  const text = block.textContent;
  if (!text.trim()) {
    // Enter on an empty cue, parenthetical or line of dialogue clears it to action.
    if (el === "action") return false;
    view.dispatch(state.tr.setNodeMarkup($from.before(), undefined, { ...block.attrs, el: "action" }));
    return true;
  }
  // Inside the brackets `(` made, Enter finishes the parenthetical rather than splitting it.
  const rest = text.slice($from.parentOffset);
  if ($from.parentOffset < block.content.size && !(el === "paren" && rest === ")")) return false;

  let now = el;
  const typed = el === "action" ? typedAs(text) : null;
  if (typed) {
    // Its own step: ⌘Z after Enter takes the new line back first, then this.
    view.dispatch(setElementAt(state.tr, $from.before(), typed));
    now = typed;
  }
  const after = view.state;
  const at = after.selection.$from.end();
  const tr = after.tr.split(at, 1, [{ type: block.type, attrs: { ...block.attrs, el: ENTER_NEXT[now] } }]);
  tr.setSelection(TextSelection.create(tr.doc, at + 2));
  view.dispatch(typed ? closeHistory(tr) : tr);
  return true;
}

function cycle(editor: Editor, table: Record<ScriptElement, ScriptElement>): boolean {
  if (editor.state.selection.$from.parent.type.name !== "paragraph") return false;
  return setElement(editor, table[elementAt(editor.state)]);
}

/** Blocks from Fountain-style text, ready to paste. */
function blocksFrom(schema: Schema, text: string): PMNode[] {
  return parseLines(text).map(([el, words]) => {
    const parts = words.split("\n").flatMap((part, i) => {
      const nodes: PMNode[] = i ? [schema.nodes.hardBreak.create()] : [];
      return part ? [...nodes, schema.text(part)] : nodes;
    });
    return schema.nodes.paragraph.create({ el }, parts);
  });
}

const ELEMENT_KEYS: [keyof typeof SHORTCUTS, ScriptElement][] = [
  ["scriptHeading", "heading"],
  ["scriptAction", "action"],
  ["scriptCue", "cue"],
  ["scriptParen", "paren"],
  ["scriptDialogue", "dialogue"],
  ["scriptTransition", "transition"],
];

export const ScriptKeys = Extension.create({
  name: "scriptKeys",
  // Ahead of the editor's own Enter; a picker (`@`, `^`, `/`) that is open keeps its keys.
  priority: 101,

  addKeyboardShortcuts() {
    const picking = () => mentionIsOpen() || slashIsOpen();
    const keys: Record<string, (props: { editor: Editor }) => boolean> = {
      Enter: ({ editor }) => !picking() && enter(editor),
      Tab: ({ editor }) => !picking() && cycle(editor, TAB_NEXT),
      "Shift-Tab": ({ editor }) => !picking() && cycle(editor, SHIFT_TAB_NEXT),
    };
    for (const [id, el] of ELEMENT_KEYS)
      keys[editorKey(SHORTCUTS[id].combo)] = ({ editor }) => setElement(editor, el);
    return keys;
  },

  addInputRules() {
    return [
      // "INT. " or "EXT. " at the start of an action line starts a scene heading.
      new InputRule({
        find: /^(int|ext|est|i\/e|int\.?\/ext|ext\.?\/int)\. $/i,
        handler: ({ state, range, match }) => {
          const $from = state.doc.resolve(range.from);
          const el = $from.parent.attrs.el;
          if (el && el !== "action") return null;
          state.tr.insertText(match[0].toUpperCase(), range.from, range.to);
          state.tr.setNodeMarkup($from.before(), undefined, { ...$from.parent.attrs, el: "heading" });
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("scriptKeys"),
        props: {
          handleTextInput(view, from, to, text) {
            const { state } = view;
            const block = state.selection.$from.parent;
            if (block.type.name !== "paragraph") return false;
            const el = elementAt(state);
            if (text === "(" && !block.textContent && (el === "dialogue" || el === "paren")) {
              // An empty line of speech, opened with a bracket, is a parenthetical.
              const tr = setElementAt(state.tr, state.selection.$from.before(), "paren").insertText(
                "()",
                from,
                to,
              );
              view.dispatch(tr.setSelection(TextSelection.create(tr.doc, from + 1)));
              return true;
            }
            if (text === ")" && from === to && state.doc.textBetween(from, from + 1) === ")") {
              // Typing the bracket `(` already closed steps over it.
              view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, from + 1)));
              return true;
            }
            if (CAPITALS.includes(el) && text !== text.toUpperCase()) {
              view.dispatch(state.tr.insertText(text.toUpperCase(), from, to));
              return true;
            }
            return false;
          },
          handlePaste(view, event) {
            const data = event.clipboardData;
            const text = data?.getData("text/plain") ?? "";
            // Copied from this editor: it carries its elements already.
            if (!text.includes("\n") || data?.getData("text/html").includes("data-el")) return false;
            const nodes = blocksFrom(view.state.schema, text);
            if (!nodes.length) return false;
            view.dispatch(view.state.tr.replaceSelection(new Slice(Fragment.fromArray(nodes), 0, 0)));
            return true;
          },
        },
      }),
    ];
  },
});

/** The scene's blocks as (element, text) read as the page shows them, for the page count. */
export function docBlocks(doc: PMNode): [ScriptElement, string][] {
  const out: [ScriptElement, string][] = [];
  doc.forEach((node) => {
    if (!node.isTextblock) return;
    const el = node.attrs.el;
    out.push([isElement(el) ? el : "action", readerText(node.textBetween(0, node.content.size, "\n", " "))]);
  });
  return out;
}
