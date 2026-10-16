import { useEffect, useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";
import { setSlashCallbacks, setSlashCommands, setSlashIsOpen } from "../story/SlashCommandExtension";
import { matchSlash, slashCommandsFor, type SlashAction } from "../../lib/editor/slashCommands";
import { toast } from "../../stores/toastStore";
import type { StoryFormat } from "../../types";
import { toggleDual } from "./script/dualDialogue";
import { setElement } from "./script/ScriptElementExtension";
import { markUsed } from "../../stores/typingStore";
import { navigateTo } from "../../lib/navigation";

interface Args {
  editor: Editor | null;
  format: StoryFormat;
  openDialoguePicker: () => void;
  /** `/note`, `/todo`: a note or to-do in the margin on the sentence at the cursor (doc 15 N1). */
  addNote: (kind: "note" | "todo") => void;
  /** `/image`: the image picker, as ⋯ › Insert image. */
  insertImage: () => void;
  /** `/split`: the scene split at the cursor (doc 29 D6), as ⋯ › Split the scene here. */
  splitScene?: () => void;
  /** The practice page (doc 26, P5): no scene, so no notes or images. */
  practice?: boolean;
}

const NEEDS_A_SCENE = new Set(["note", "todo", "image", "split"]);

/**
 * The `/` command picker (lib/editor/slashCommands.ts) and what its commands drive: the
 * dialogue speaker picker, a margin note or to-do, the image picker, the `@` and `[[` pickers,
 * and in a script the element of the line (doc 25, P3½).
 */
export function useSlashCommands({
  editor,
  format,
  openDialoguePicker,
  addNote,
  insertImage,
  splitScene,
  practice,
}: Args) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ bottom: 0, left: 0 });
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [selIdx, setSelIdx] = useState(0);
  const commands = useMemo(
    () => slashCommandsFor(format).filter((c) => !practice || !NEEDS_A_SCENE.has(c.action.kind)),
    [format, practice],
  );
  const matching = useMemo(() => matchSlash(commands, query), [commands, query]);
  useEffect(() => {
    setSlashCommands(commands);
  }, [commands]);

  function close() {
    setOpen(false);
    setSlashIsOpen(false);
    setQuery("");
    setRange(null);
  }

  function run(action: SlashAction, slashFrom: number, slashTo: number) {
    close();
    if (!editor) return;
    // The typed "/query" goes, and for a picker its own opening characters take its place.
    const text = action.kind === "type" ? action.text : "";
    editor.view.dispatch(editor.state.tr.insertText(text, slashFrom, slashTo));
    markUsed("slash");
    if (action.kind === "dialogue") openDialoguePicker();
    else if (action.kind === "note" || action.kind === "todo") {
      addNote(action.kind);
      markUsed(action.kind);
    } else if (action.kind === "image") {
      insertImage();
      markUsed("image");
    } else if (action.kind === "element") setElement(editor, action.el);
    else if (action.kind === "help") return navigateTo("/guides/typing");
    else if (action.kind === "split") return splitScene?.();
    else if (action.kind === "together" && toggleDual(editor) === "none")
      toast.info(
        "Put the cursor in a speech that follows another; the two are then spoken at the same time.",
      );
    editor.commands.focus();
  }

  function execute(name: string, slashFrom: number, slashTo: number) {
    const cmd = commands.find((c) => c.name === name);
    if (cmd) run(cmd.action, slashFrom, slashTo);
  }

  useEffect(() => {
    setSlashCallbacks({
      onOpen: (q, slashFrom, slashTo, bottom, left) => {
        setQuery(q);
        setRange({ from: slashFrom, to: slashTo });
        setPos({ bottom, left });
        setOpen(true);
        setSlashIsOpen(true);
        setSelIdx(0);
      },
      onClose: close,
      onArrowDown: () => setSelIdx((i) => Math.min(i + 1, matching.length - 1)),
      onArrowUp: () => setSelIdx((i) => Math.max(i - 1, 0)),
      onExecute: () => {
        if (!editor || !range) return;
        const cmd = matching[selIdx] ?? matching[0];
        if (cmd) run(cmd.action, range.from, range.to);
      },
    });
  }, [editor, range, matching, selIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    slash: { open, pos, query, range, selIdx, matching, execute },
  };
}

export type SlashState = ReturnType<typeof useSlashCommands>["slash"];
