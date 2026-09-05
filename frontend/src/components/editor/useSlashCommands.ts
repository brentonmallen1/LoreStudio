import { useEffect, useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";
import { api } from "../../api/client";
import type { Story, StoryTodo, StructureNode } from "../../types";
import { useUIStore } from "../../stores/uiStore";
import { setSlashCallbacks, setSlashIsOpen, SLASH_COMMANDS } from "../story/SlashCommandExtension";
import { setTodoGutterItems, setTodoGutterCallbacks, FORCE_TODO_REBUILD } from "../story/TodoExtension";

interface Args {
  editor: Editor | null;
  activeNode: StructureNode | null;
  activeStory: Story | null;
  openDialoguePicker: (bottom: number, left: number) => void;
}

/**
 * The `/` command picker and what its two commands drive: the dialogue speaker
 * picker (`/dialogue`) and the inline TODO input (`/todo`), plus the TODO
 * gutter markers for the scene.
 */
export function useSlashCommands({ editor, activeNode, activeStory, openDialoguePicker }: Args) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ bottom: 0, left: 0 });
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [selIdx, setSelIdx] = useState(0);

  const [todosState, setTodosState] = useState<{ nodeId: string | null; todos: StoryTodo[] }>({
    nodeId: null,
    todos: [],
  });
  const sceneTodos = useMemo(
    () => (todosState.nodeId === (activeNode?.id ?? null) ? todosState.todos : []),
    [todosState, activeNode?.id],
  );
  const [todoInputOpen, setTodoInputOpen] = useState(false);
  const [todoInputPos, setTodoInputPos] = useState({ bottom: 0, left: 0 });
  const [todoInputText, setTodoInputText] = useState("");
  const [todoInputDocFrom, setTodoInputDocFrom] = useState<number | null>(null);

  // Load scene todos for gutter markers
  useEffect(() => {
    if (!activeNode) return;
    const nodeId = activeNode.id;
    api
      .getTodosForScene(nodeId)
      .then((todos) => setTodosState({ nodeId, todos }))
      .catch(() => {});
  }, [activeNode?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync gutter items whenever todos change and ask the editor to rebuild decorations
  useEffect(() => {
    setTodoGutterItems(
      sceneTodos
        .filter((t) => t.doc_from != null && !t.done)
        .map((t) => ({ id: t.id, content: t.content, done: t.done, doc_from: t.doc_from! })),
    );
    if (editor) {
      const { state, dispatch } = editor.view;
      dispatch(state.tr.setMeta(FORCE_TODO_REBUILD, true));
    }
  }, [sceneTodos, editor]);

  useEffect(() => {
    setTodoGutterCallbacks({
      onMarkerClick: () => useUIStore.getState().setViewMode("todos"),
    });
  }, []);

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
      setTodoInputDocFrom(slashFrom);
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
      const newTodo = await api.createTodo(activeStory.id, {
        content,
        node_id: activeNode.id,
        doc_from: todoInputDocFrom,
        doc_to: todoInputDocFrom,
      });
      setTodosState((prev) => ({
        nodeId: activeNode.id,
        todos: [...(prev.nodeId === activeNode.id ? prev.todos : []), newTodo],
      }));
    } catch {
      // the todo will still be visible in list view if it was created
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
