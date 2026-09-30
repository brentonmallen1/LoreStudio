import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { Character, Location, Story } from "../../types";
import {
  setMentionItems,
  setMentionCallbacks,
  setMentionIsOpen,
  setMentionDialogueCallbacks,
  setMentionAttributionCallbacks,
  isMentionAttributionMode,
  FORCE_MENTION_KEY,
  type MentionItem,
} from "../story/MentionDropdown";
import {
  setDialogueCallbacks,
  isDialogueModeActive,
  setDialogueModeActive,
} from "../story/DialogueExtension";

interface Args {
  editor: Editor | null;
  activeStory: Story | null;
  characters: Character[];
  setCharacters: (chars: Character[]) => void;
}

/**
 * The @mention / ^dialogue / <attribution dropdown. One dropdown, three modes:
 * - plain: `@Name` or `[[Setting]]` insertion
 * - dialogue (`^` or /dialogue): inserts `""<Name>` or wraps a selection
 * - attribution (`<` after a closing quote): completes `<Name>`
 *
 * Also owns the flat location list for the story, which feeds the mention
 * items, the scene settings picker and the hover card.
 */
export function useMentionDropdown({ editor, activeStory, characters, setCharacters }: Args) {
  // Characters and places both come from the store (the workspace loads places once,
  // doc 11); the mention items follow whichever list changes.
  const flatLocations: Location[] = useStoryStore((s) => s.locations);
  const allItems = useMemo<MentionItem[]>(
    () =>
      activeStory
        ? [
            ...characters.map((c) => ({ type: "character" as const, name: c.name, role: c.role })),
            ...flatLocations.map((s) => ({ type: "setting" as const, name: s.name })),
          ]
        : [],
    [activeStory, characters, flatLocations],
  );
  const [open, setOpen_] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState({ bottom: 0, left: 0 });
  const [selIdx, setSelIdx] = useState(0);
  const [dialogueMode, setDialogueMode] = useState(false);
  const [attributionMode, setAttributionMode] = useState(false);
  // Refs for stable access inside ProseMirror callbacks
  const queryRef = useRef("");
  const selIdxRef = useRef(0);
  const filteredRef = useRef<MentionItem[]>([]);
  const insertRef = useRef<((item: MentionItem) => void) | null>(null);
  // Set by triggerAttributeDialogue to wrap a selection range instead of inserting at cursor
  const pendingWrapRef = useRef<{ from: number; to: number } | null>(null);

  function setOpen(next: boolean) {
    setOpen_(next);
    setMentionIsOpen(next);
    if (!next) setAttributionMode(false);
  }

  // Hand the items to the decoration plugin and rebuild whenever they, or the editor, change.
  useEffect(() => {
    setMentionItems(allItems);
    if (editor?.view) editor.view.dispatch(editor.state.tr.setMeta(FORCE_MENTION_KEY, true));
  }, [allItems, editor]);

  const filteredItems = useMemo(() => {
    const characterOnly = dialogueMode || attributionMode;
    const base = allItems.filter(
      (item) =>
        item.name.toLowerCase().startsWith(query.toLowerCase()) &&
        (!characterOnly || item.type === "character"),
    );
    const q = query.trim();
    if (
      q &&
      activeStory &&
      !allItems.some((i) => i.type === "character" && i.name.toLowerCase() === q.toLowerCase())
    ) {
      base.push({ type: "create", name: q });
    }
    return base;
  }, [allItems, query, attributionMode, dialogueMode, activeStory]);

  // Refs are read by ProseMirror callbacks (event time), so syncing after render is fine.
  useEffect(() => {
    queryRef.current = query;
    selIdxRef.current = selIdx;
    filteredRef.current = filteredItems;
  });

  const openAt = useCallback(
    (q: string, bottom: number, left: number, mode: "plain" | "dialogue" | "attribution") => {
      if (mode === "dialogue") setDialogueModeActive(true);
      setQuery(q);
      setPos({ bottom, left });
      setOpen_(true);
      setMentionIsOpen(true);
      setDialogueMode(mode === "dialogue");
      setAttributionMode(mode === "attribution");
      setSelIdx(0);
      selIdxRef.current = 0;
    },
    [],
  );

  const insert = useCallback(
    async (item: MentionItem) => {
      if (!editor) return;
      const { from } = editor.state.selection;
      const q = queryRef.current;
      const inDialogueMode = isDialogueModeActive();
      const inAttributionMode = isMentionAttributionMode();

      if (item.type === "create" && activeStory) {
        const name = item.name.trim();
        let createdName = name;
        try {
          const newChar = await api.createCharacter(activeStory.id, { name });
          createdName = newChar.name;
          // The store's cast is the source of the items: adding them there rebuilds the decorations.
          setCharacters([...characters, newChar]);
        } catch {
          /* fall through with typed name */
        }
        insertRef.current?.({ type: "character", name: createdName });
        return;
      }

      if (inAttributionMode && item.type === "character") {
        const start = from - q.length; // position right after <
        editor
          .chain()
          .focus()
          .command(({ tr, dispatch }) => {
            if (dispatch) tr.insertText(`${item.name}>`, start, from);
            return true;
          })
          .run();
        setAttributionMode(false);
        setOpen_(false);
        setMentionIsOpen(false);
        setSelIdx(0);
        return;
      }

      if (inDialogueMode && item.type === "character") {
        const pendingWrap = pendingWrapRef.current;
        if (pendingWrap) {
          pendingWrapRef.current = null;
          const selectedText = editor.state.doc.textBetween(pendingWrap.from, pendingWrap.to);
          const wrapped = `"${selectedText}"<${item.name}>`;
          editor
            .chain()
            .focus()
            .command(({ tr, dispatch }) => {
              if (dispatch)
                tr.replaceWith(pendingWrap.from, pendingWrap.to, editor.state.schema.text(wrapped));
              return true;
            })
            .run();
        } else {
          const start = from - q.length - 1; // -1 for the ^ prefix
          editor
            .chain()
            .focus()
            .command(({ tr, dispatch }) => {
              if (dispatch) tr.insertText(`""<${item.name}>`, start, from);
              return true;
            })
            .run();
          editor
            .chain()
            .setTextSelection(start + 1)
            .run(); // between the quotes
        }
        setDialogueModeActive(false);
      } else {
        const start = from - q.length - 1; // -1 for the @ character
        const text = item.type === "character" ? `@${item.name}` : `[[${item.name}]]`;
        editor
          .chain()
          .focus()
          .command(({ tr, dispatch }) => {
            if (dispatch) tr.insertText(text, start, from);
            return true;
          })
          .run();
      }
      setOpen(false);
      setDialogueMode(false);
      setAttributionMode(false);
      setSelIdx(0);
    },
    [editor, activeStory, characters, setCharacters],
  );

  useEffect(() => {
    insertRef.current = insert;
  }, [insert]);

  // Wire the ProseMirror-side callbacks once; they read fresh state through refs.
  useEffect(() => {
    setMentionCallbacks({
      onOpen: (q, bottom, left) => openAt(q, bottom, left, "plain"),
      onClose: () => {
        if (isDialogueModeActive()) return; // dialogue picker reuses this dropdown
        setOpen_(false);
        setMentionIsOpen(false);
      },
      onArrowDown: () =>
        setSelIdx((i) => {
          const next = Math.min(i + 1, filteredRef.current.length - 1);
          selIdxRef.current = next;
          return next;
        }),
      onArrowUp: () =>
        setSelIdx((i) => {
          const next = Math.max(i - 1, 0);
          selIdxRef.current = next;
          return next;
        }),
      onEnterSelect: () => {
        const items = filteredRef.current;
        const item = items[Math.min(selIdxRef.current, items.length - 1)];
        if (item && insertRef.current) insertRef.current(item);
      },
    });
    setMentionDialogueCallbacks(
      (q, bottom, left) => openAt(q, bottom, left, "dialogue"),
      () => {
        setDialogueModeActive(false);
        setOpen_(false);
        setMentionIsOpen(false);
        setDialogueMode(false);
      },
    );
    setMentionAttributionCallbacks(
      (q, bottom, left) => openAt(q, bottom, left, "attribution"),
      () => {
        setOpen_(false);
        setMentionIsOpen(false);
        setAttributionMode(false);
      },
    );
    setDialogueCallbacks({});
  }, [openAt]);

  /** Open the speaker picker at the cursor (used by /dialogue and the palette trigger). */
  function openDialoguePicker(bottom: number, left: number) {
    openAt("", bottom, left, "dialogue");
  }

  /** Wrap the current selection as attributed dialogue via the speaker picker. */
  function triggerAttributeDialogue() {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) return;
    const coords = editor.view.coordsAtPos(from);
    openAt("", coords.top - 8, coords.left, "dialogue");
    pendingWrapRef.current = { from, to };
  }

  return {
    open,
    pos,
    selIdx,
    filteredItems,
    dialogueMode,
    attributionMode,
    flatLocations,
    insert,
    openDialoguePicker,
    triggerAttributeDialogue,
  };
}

export type MentionDropdownState = ReturnType<typeof useMentionDropdown>;
