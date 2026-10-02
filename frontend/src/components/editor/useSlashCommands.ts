import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { notesApi } from "../../api/notes";
import type { Story, StructureNode } from "../../types";
import { setSlashCallbacks, setSlashIsOpen, SLASH_COMMANDS } from "../story/SlashCommandExtension";

interface Args {
  editor: Editor | null;
  activeNode: StructureNode | null;
  activeStory: Story | null;
  openDialoguePicker: (bottom: number, left: number) => void;
}

/**
 * The `/` command picker and what its two commands drive: the dialogue speaker
 * picker (`/dialogue`) and the inline to-do input (`/todo`), which adds a to-do
 * on the scene (doc 15).
 */
export function useSlashCommands({ editor, activeNode, activeStory, openDialoguePicker }: Args) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ bottom: 0, left: 0 });
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [selIdx, setSelIdx] = useState(0);

  const [todoInputOpen, setTodoInputOpen] = useState(false);
  const [todoInputPos, setTodoInputPos] = useState({ bottom: 0, left: 0 });
  const [todoInputText, setTodoInputText] = useState("");

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
      setTodoInputText("");
      setTodoInputPos({ bottom: coords.bottom, left: coords.left });
      setTodoInputOpen(true);
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

  async function submitTodoInput() {
    const content = todoInputText.trim();
    setTodoInputOpen(false);
    if (!content || !activeNode || !activeStory) return;
    try {
      await notesApi.create(activeStory.id, { content, kind: "todo", node_id: activeNode.id });
    } catch {
      // the to-do will still be visible in the list if it was created
    }
  }

  return {
    slash: { open, pos, query, range, selIdx, execute },
    todoInput: {
      open: todoInputOpen,
      pos: todoInputPos,
      text: todoInputText,
      setText: setTodoInputText,
      submit: submitTodoInput,
      cancel: () => setTodoInputOpen(false),
    },
  };
}

export type SlashState = ReturnType<typeof useSlashCommands>["slash"];
export type TodoInputState = ReturnType<typeof useSlashCommands>["todoInput"];
