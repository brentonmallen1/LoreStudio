import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import type { Character, Location, Story } from "../../types";
import {
  ghostText,
  quotePair,
  suggest,
  type Choice,
  type Entry,
  type Trigger,
  type TriggerMode,
} from "../../lib/prose/completion";
import {
  FORCE_MENTION_KEY,
  GHOST_KEY,
  setMentionCallbacks,
  setMentionEntries,
  setMentionGhost,
  setMentionIsOpen,
} from "../story/MentionDropdown";
import { FORCE_DIALOGUE_KEY, likelySpeaker } from "../story/DialogueExtension";

interface Args {
  editor: Editor | null;
  activeStory: Story | null;
  characters: Character[];
  setCharacters: (chars: Character[]) => void;
}

/** The quoted line just before a "<" being typed, for the speaker picker to rank by. */
const LINE_BEFORE_TAG = new RegExp(
  '[\u201c"\u2018\']([^\u201c\u201d"]+)[\u201d"\u2019\'][ \\u00a0]?<[^<>\\n]*$',
);

/**
 * The pickers that complete the inline syntax as it is typed (doc 16, lib/prose/completion):
 * `@` a character or place, `[[` a place, `<` after a closing quote its speaker, `^` (or
 * /dialogue, or Attribute on a selection) a new line for someone. Enter or Tab takes the
 * chosen suggestion, and its faint rest shows after the cursor; Escape closes.
 *
 * Also owns the flat location list for the story, which feeds the scene settings picker
 * and the hover card.
 */
export function useMentionDropdown({ editor, activeStory, characters, setCharacters }: Args) {
  // Characters and places both come from the store (the workspace loads places once,
  // doc 11); the mention entries follow whichever list changes.
  const flatLocations: Location[] = useStoryStore((s) => s.locations);
  const upsertLocation = useStoryStore((s) => s.upsertLocation);
  const entries = useMemo<Entry[]>(
    () =>
      activeStory
        ? [
            ...characters.map((c) => ({
              kind: "character" as const,
              name: c.name,
              aliases: c.aliases ?? [],
              role: c.role,
              slot: c.color_slot,
            })),
            ...flatLocations.map((l) => ({
              kind: "place" as const,
              name: l.name,
              aliases: l.aliases ?? [],
              slot: l.color_slot,
            })),
          ]
        : [],
    [activeStory, characters, flatLocations],
  );

  const [open, setOpen_] = useState(false);
  const [mode, setMode] = useState<TriggerMode>("mention");
  const [query, setQuery] = useState("");
  const [preferred, setPreferred] = useState<string | null>(null);
  const [pos, setPos] = useState({ bottom: 0, left: 0 });
  const [selIdx, setSelIdx] = useState(0);
  // Where the typed syntax starts (the @, [[, ^ or the speaker's first letter), so a choice
  // replaces it; and the selection Attribute is wrapping, when that opened the picker.
  const anchorRef = useRef(0);
  const wrapRef = useRef<{ from: number; to: number } | null>(null);
  const [wrapping, setWrapping] = useState(false);

  const choices = useMemo(() => suggest(mode, query, entries, preferred), [mode, query, entries, preferred]);

  // Read by ProseMirror callbacks (event time), so syncing after render is fine.
  const live = useRef({ choices, selIdx, mode });
  useEffect(() => {
    live.current = { choices, selIdx, mode };
  });

  const setOpen = useCallback((next: boolean) => {
    setOpen_(next);
    setMentionIsOpen(next);
    if (!next) {
      wrapRef.current = null;
      setWrapping(false);
    }
  }, []);

  // Hand the names to the decorations and rebuild whenever they, or the editor, change.
  useEffect(() => {
    setMentionEntries(entries);
    // Speaker tags resolve by the same names, so the dialogue decorations rebuild too.
    if (editor?.view)
      editor.view.dispatch(
        editor.state.tr.setMeta(FORCE_MENTION_KEY, true).setMeta(FORCE_DIALOGUE_KEY, true),
      );
  }, [entries, editor]);

  // The faint rest of the chosen suggestion, redrawn when it changes.
  const ghost = open && !wrapping ? ghostText(query, choices[selIdx]) : "";
  useEffect(() => {
    setMentionGhost(ghost);
    if (editor?.view && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(GHOST_KEY, true));
  }, [ghost, editor]);

  const openFor = useCallback(
    (trigger: Trigger, before: string, bottom: number, left: number) => {
      if (!editor) return;
      anchorRef.current = editor.state.selection.from - (before.length - trigger.start);
      const line = trigger.mode === "speaker" ? LINE_BEFORE_TAG.exec(before) : null;
      setPreferred(line ? likelySpeaker(line[1]) : null);
      setMode(trigger.mode);
      setQuery(trigger.query);
      setPos({ bottom, left });
      setSelIdx(0);
      setOpen(true);
    },
    [editor, setOpen],
  );

  /** Write a choice into the prose, replacing what was typed to ask for it. */
  const write = useCallback(
    (choice: Choice) => {
      if (!editor) return;
      const { mode } = live.current;
      const cursor = editor.state.selection.from;
      const after = editor.state.doc.textBetween(cursor, editor.state.doc.resolve(cursor).end(), "\n", "\0");
      const anchor = anchorRef.current;
      const wrap = wrapRef.current;
      const [openQuote, closeQuote] = quotePair(editor.state.doc.textContent);
      editor
        .chain()
        .focus()
        .command(({ tr, dispatch }) => {
          if (!dispatch) return true;
          if (wrap) {
            // Attribute: quote marks go around the selection, so its italics stay.
            const text = tr.doc.textBetween(wrap.from, wrap.to);
            tr.insertText(`${/["”’']$/.test(text) ? "" : closeQuote}<${choice.words}>`, wrap.to);
            if (!/^["“‘']/.test(text)) tr.insertText(openQuote, wrap.from);
          } else if (mode === "mention") {
            tr.insertText(
              choice.kind === "character" ? `@${choice.words}` : `[[${choice.words}]]`,
              anchor,
              cursor,
            );
          } else if (mode === "place") {
            tr.insertText(`[[${choice.words}]]`, anchor, cursor + (after.startsWith("]]") ? 2 : 0));
          } else if (mode === "speaker") {
            // Editing a tag replaces the rest of it, rather than leaving a second ">".
            const rest = /^[^<>\n]*>/.exec(after)?.[0].length ?? 0;
            tr.insertText(`${choice.words}>`, anchor, cursor + rest);
          } else {
            tr.insertText(`${openQuote}${closeQuote}<${choice.words}>`, anchor, cursor);
            tr.setSelection(TextSelection.create(tr.doc, anchor + 1));
          }
          return true;
        })
        .run();
      setOpen(false);
    },
    [editor, setOpen],
  );

  const accept = useCallback(
    async (choice: Choice) => {
      if (!choice.create || !activeStory) return write(choice);
      try {
        if (choice.kind === "character") {
          const made = await api.createCharacter(activeStory.id, { name: choice.name });
          // The store's cast is the source of the names: adding them there rebuilds the decorations.
          setCharacters([...useStoryStore.getState().characters, made]);
          write({ ...choice, name: made.name, words: made.name, create: false });
        } else {
          const made = await api.createLocation(activeStory.id, { name: choice.name });
          upsertLocation(made);
          write({ ...choice, name: made.name, words: made.name, create: false });
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "That didn't work; try again.");
      }
    },
    [activeStory, setCharacters, upsertLocation, write],
  );

  // Wire the ProseMirror-side callbacks; they read fresh state through refs.
  useEffect(() => {
    setMentionCallbacks({
      onTrigger: openFor,
      onClose: () => {
        // Attribute keeps its picker open over the selection until a choice or Escape.
        if (!wrapRef.current) setOpen(false);
      },
      onEscape: () => setOpen(false),
      onArrowDown: () => setSelIdx((i) => Math.min(i + 1, live.current.choices.length - 1)),
      onArrowUp: () => setSelIdx((i) => Math.max(i - 1, 0)),
      onAccept: () => {
        const { choices, selIdx } = live.current;
        const choice = choices[Math.min(selIdx, choices.length - 1)];
        if (choice) void accept(choice);
      },
    });
  }, [openFor, accept, setOpen]);

  /** A new line of dialogue at the cursor (/dialogue, the palette): types the ^ that asks. */
  function openDialoguePicker() {
    if (!editor) return;
    const { from } = editor.state.selection;
    const prev = editor.state.doc.textBetween(
      Math.max(editor.state.doc.resolve(from).start(), from - 1),
      from,
    );
    editor
      .chain()
      .focus()
      .insertContent(/[\p{L}\p{N}]/u.test(prev) ? " ^" : "^")
      .run();
  }

  /** Make the selection a line of dialogue: pick its speaker, and it is quoted and tagged. */
  function triggerAttributeDialogue() {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) return;
    const coords = editor.view.coordsAtPos(from);
    wrapRef.current = { from, to };
    setWrapping(true);
    setMode("line");
    setQuery("");
    setPreferred(null);
    setPos({ bottom: coords.top - 8, left: coords.left });
    setSelIdx(0);
    setOpen(true);
  }

  return {
    open,
    mode,
    pos,
    selIdx,
    choices,
    flatLocations,
    accept,
    close: () => setOpen(false),
    openDialoguePicker,
    triggerAttributeDialogue,
  };
}

export type MentionDropdownState = ReturnType<typeof useMentionDropdown>;
