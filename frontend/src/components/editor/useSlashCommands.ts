import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { setSlashCallbacks, setSlashIsOpen, SLASH_COMMANDS } from "../story/SlashCommandExtension";

interface Args {
  editor: Editor | null;
  openDialoguePicker: (bottom: number, left: number) => void;
  /** `/todo`: a to-do in the margin on the sentence at the cursor (doc 15 N1). */
  addTodo: () => void;
}

/**
 * The `/` command picker and what its two commands drive: the dialogue speaker
 * picker (`/dialogue`) and a margin to-do on the sentence at the cursor (`/todo`).
 */
export function useSlashCommands({ editor, openDialoguePicker, addTodo }: Args) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ bottom: 0, left: 0 });
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [selIdx, setSelIdx] = useState(0);

  function close() {
    setOpen(false);
    setSlashIsOpen(false);
    setQuery("");
    setRange(null);
  }

  function execute(name: string, slashFrom: number, slashTo: number) {
    close();
    if (!editor) return;
    const coords = editor.view.coordsAtPos(slashFrom);
    const deleteSlashText = () =>
      editor
        .chain()
        .command(({ tr, dispatch }) => {
          if (dispatch) tr.delete(slashFrom, slashTo);
          return true;
        })
        .run();

    if (name === "dialogue") {
      deleteSlashText();
      openDialoguePicker(coords.bottom, coords.left);
    }
    if (name === "todo") {
      deleteSlashText();
      addTodo();
    }
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
      onArrowDown: () => setSelIdx((i) => Math.min(i + 1, SLASH_COMMANDS.length - 1)),
      onArrowUp: () => setSelIdx((i) => Math.max(i - 1, 0)),
      onExecute: () => {
        if (!editor || !range) return;
        const matching = SLASH_COMMANDS.filter((c) => c.name.startsWith(query));
        const cmd = matching[selIdx] ?? matching[0];
        if (cmd) execute(cmd.name, range.from, range.to);
      },
    });
  }, [editor, range, query, selIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    slash: { open, pos, query, range, selIdx, execute },
  };
}

export type SlashState = ReturnType<typeof useSlashCommands>["slash"];
