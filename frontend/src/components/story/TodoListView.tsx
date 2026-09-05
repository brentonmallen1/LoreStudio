import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import type { StoryTodo, StructureNode } from "../../types";
import styles from "./TodoListView.module.css";

// ---------------------------------------------------------------------------
// Persistence keys
// ---------------------------------------------------------------------------

const GROUP_KEY = "ls_todo_group";
const SORT_KEY = "ls_todo_sort";

type GroupMode = "scene" | "structure" | "none";
type SortMode = "position" | "newest" | "oldest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flatten a recursive StructureNode tree into a depth-ordered list */
function flattenNodes(nodes: StructureNode[], depth = 0): Array<{ node: StructureNode; depth: number }> {
  const result: Array<{ node: StructureNode; depth: number }> = [];
  for (const node of [...nodes].sort((a, b) => a.position - b.position)) {
    result.push({ node, depth });
    if (node.children?.length) {
      result.push(...flattenNodes(node.children, depth + 1));
    }
  }
  return result;
}

/** Find a node by id in the tree */
function findNode(nodes: StructureNode[], id: string): StructureNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children ?? [], id);
    if (found) return found;
  }
  return null;
}

function sortTodos(todos: StoryTodo[], sort: SortMode): StoryTodo[] {
  return [...todos].sort((a, b) => {
    if (sort === "position") return a.position - b.position;
    if (sort === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TodoItemProps {
  todo: StoryTodo;
  showScene?: boolean;
  onToggle: (id: string, done: boolean) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (todo: StoryTodo) => void;
}

function TodoItem({ todo, showScene, onToggle, onEdit, onDelete, onNavigate }: TodoItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(todo.content);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setEditValue(todo.content);
  }, [todo.content]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  function commitEdit() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== todo.content) onEdit(todo.id, trimmed);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    }
    if (e.key === "Escape") {
      setEditValue(todo.content);
      setEditing(false);
    }
  }

  return (
    <div className={`${styles.todoItem} ${todo.done ? styles.todoDone : ""}`}>
      <button
        className={styles.todoCheck}
        onClick={() => onToggle(todo.id, !todo.done)}
        aria-label={todo.done ? "Mark as not done" : "Mark as done"}
      >
        {todo.done ? <CheckSquare size={16} /> : <Square size={16} />}
      </button>

      {editing ? (
        <input
          ref={inputRef}
          className={styles.todoEditInput}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <span
          className={styles.todoContent}
          onClick={() => !todo.done && onNavigate(todo)}
          title={todo.done ? undefined : todo.doc_from != null ? "Jump to scene" : todo.content}
        >
          {todo.content}
        </span>
      )}

      {showScene && todo.node_title && <span className={styles.todoSceneBadge}>{todo.node_title}</span>}

      <div className={styles.todoActions} ref={menuRef}>
        <button
          className={styles.todoMenuBtn}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Todo options"
        >
          <MoreHorizontal size={14} />
        </button>
        {menuOpen && (
          <div className={styles.todoMenu}>
            <button
              onClick={() => {
                setEditing(true);
                setMenuOpen(false);
              }}
            >
              <Pencil size={12} /> Edit
            </button>
            <button
              onClick={() => {
                onDelete(todo.id);
                setMenuOpen(false);
              }}
              className={styles.todoMenuDanger}
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grouped section
// ---------------------------------------------------------------------------

interface GroupSectionProps {
  label: string;
  depth?: number;
  todos: StoryTodo[];
  defaultExpanded?: boolean;
  onToggle: (id: string, done: boolean) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (todo: StoryTodo) => void;
}

function GroupSection({
  label,
  depth = 0,
  todos,
  defaultExpanded = true,
  onToggle,
  onEdit,
  onDelete,
  onNavigate,
}: GroupSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={styles.groupSection} style={{ "--depth": depth } as React.CSSProperties}>
      <button className={styles.groupHeader} onClick={() => setExpanded((v) => !v)}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className={styles.groupLabel}>{label}</span>
        <span className={styles.groupCount}>{todos.length}</span>
      </button>
      {expanded && (
        <div className={styles.groupItems}>
          {todos.map((t) => (
            <TodoItem
              key={t.id}
              todo={t}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add todo form
// ---------------------------------------------------------------------------

interface AddTodoFormProps {
  nodeId?: string | null;
  onAdd: (content: string, nodeId?: string | null) => void;
  onCancel: () => void;
  structure: StructureNode[];
}

function AddTodoForm({ nodeId, onAdd, onCancel, structure }: AddTodoFormProps) {
  const [content, setContent] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodeId ?? null);
  const inputRef = useRef<HTMLInputElement>(null);
  const flatNodes = flattenNodes(structure);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    onAdd(trimmed, selectedNodeId);
    setContent("");
  }

  return (
    <form className={styles.addForm} onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        className={styles.addInput}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What needs doing?"
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      />
      <select
        className={styles.addSceneSelect}
        value={selectedNodeId ?? ""}
        onChange={(e) => setSelectedNodeId(e.target.value || null)}
      >
        <option value="">— No scene (story-level) —</option>
        {flatNodes.map(({ node, depth }) => (
          <option key={node.id} value={node.id}>
            {"  ".repeat(depth)}
            {node.title || "Untitled"}
          </option>
        ))}
      </select>
      <div className={styles.addFormActions}>
        <button type="submit" className={styles.addSubmit} disabled={!content.trim()}>
          <Check size={14} /> Add
        </button>
        <button type="button" className={styles.addCancel} onClick={onCancel}>
          <X size={14} /> Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TodoListView() {
  const navigate = useNavigate();
  const { activeStory, structure, setActiveNode } = useStoryStore();
  const { setViewMode } = useUIStore();
  const storyId = activeStory?.id;

  const [todos, setTodos] = useState<StoryTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>(
    () => (localStorage.getItem(GROUP_KEY) as GroupMode | null) ?? "structure",
  );
  const [sortMode, setSortMode] = useState<SortMode>(
    () => (localStorage.getItem(SORT_KEY) as SortMode | null) ?? "position",
  );
  const [doneExpanded, setDoneExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingDone, setDeletingDone] = useState(false);

  // Persist prefs
  useEffect(() => {
    localStorage.setItem(GROUP_KEY, groupMode);
  }, [groupMode]);
  useEffect(() => {
    localStorage.setItem(SORT_KEY, sortMode);
  }, [sortMode]);

  const loadTodos = useCallback(async () => {
    if (!storyId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.listTodos(storyId);
      setTodos(data);
    } catch {
      setError("Failed to load todos");
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  const handleToggle = useCallback(async (id: string, done: boolean) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
    try {
      await api.updateTodo(id, { done });
    } catch {
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !done } : t)));
    }
  }, []);

  const handleEdit = useCallback(
    async (id: string, content: string) => {
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, content } : t)));
      try {
        await api.updateTodo(id, { content });
      } catch {
        loadTodos();
      }
    },
    [loadTodos],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setTodos((prev) => prev.filter((t) => t.id !== id));
      try {
        await api.deleteTodo(id);
      } catch {
        loadTodos();
      }
    },
    [loadTodos],
  );

  const handleNavigate = useCallback(
    (todo: StoryTodo) => {
      if (!todo.node_id || !storyId) return;
      const node = findNode(structure, todo.node_id);
      if (!node) return;
      setActiveNode(node);
      setViewMode("tree");
      navigate(`/stories/${storyId}/write`);
    },
    [structure, storyId, navigate, setViewMode, setActiveNode],
  );

  const handleAdd = useCallback(
    async (content: string, nodeId?: string | null) => {
      if (!storyId) return;
      try {
        const newTodo = await api.createTodo(storyId, { content, node_id: nodeId ?? null });
        setTodos((prev) => [...prev, newTodo]);
        setShowAddForm(false);
      } catch {
        // ignore
      }
    },
    [storyId],
  );

  const handleDeleteDone = useCallback(async () => {
    if (!storyId) return;
    setDeletingDone(true);
    try {
      await api.deleteDoneTodos(storyId);
      setTodos((prev) => prev.filter((t) => !t.done));
    } catch {
      // ignore
    } finally {
      setDeletingDone(false);
    }
  }, [storyId]);

  // Derived lists
  const activeTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);
  const sortedActive = sortTodos(activeTodos, sortMode);
  const sortedDone = sortTodos(doneTodos, sortMode);

  // Build grouped content
  function renderGrouped() {
    if (groupMode === "none") {
      return (
        <div className={styles.flatList}>
          {sortedActive.map((t) => (
            <TodoItem
              key={t.id}
              todo={t}
              showScene
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      );
    }

    if (groupMode === "scene") {
      // Group by node_id (flat)
      const groups = new Map<string | null, StoryTodo[]>();
      for (const t of sortedActive) {
        const key = t.node_id;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(t);
      }

      // Order groups by scene order (using flat node list)
      const flatNodes = flattenNodes(structure);
      const orderedKeys: Array<string | null> = [
        ...flatNodes.map(({ node }) => node.id).filter((id) => groups.has(id)),
        ...(groups.has(null) ? [null] : []),
      ];

      return (
        <>
          {orderedKeys.map((key) => {
            const node = key ? findNode(structure, key) : null;
            const label = node?.title || (key ? "Unknown Scene" : "General (no scene)");
            const items = groups.get(key) ?? [];
            return (
              <GroupSection
                key={key ?? "__general__"}
                label={label}
                todos={items}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onNavigate={handleNavigate}
              />
            );
          })}
        </>
      );
    }

    // "structure" mode — hierarchical
    const flatNodes = flattenNodes(structure);
    const renderedSections: React.ReactNode[] = [];

    for (const { node, depth } of flatNodes) {
      const nodeTodos = sortedActive.filter((t) => t.node_id === node.id);
      if (nodeTodos.length === 0) continue;
      renderedSections.push(
        <GroupSection
          key={node.id}
          label={node.title || "Untitled"}
          depth={depth}
          todos={nodeTodos}
          onToggle={handleToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onNavigate={handleNavigate}
        />,
      );
    }

    const generalTodos = sortedActive.filter((t) => t.node_id == null);
    if (generalTodos.length > 0) {
      renderedSections.push(
        <GroupSection
          key="__general__"
          label="General (no scene)"
          todos={generalTodos}
          onToggle={handleToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onNavigate={handleNavigate}
        />,
      );
    }

    return <>{renderedSections}</>;
  }

  if (loading) {
    return (
      <div className={styles.root}>
        <div className={styles.loading}>Loading todos…</div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <CheckSquare size={18} />
          <span>TODOs</span>
          {activeTodos.length > 0 && <span className={styles.headerCount}>{activeTodos.length}</span>}
        </div>
        <div className={styles.headerActions}>
          <button className={styles.addBtn} onClick={() => setShowAddForm((v) => !v)}>
            <Plus size={14} /> Add
          </button>
          {doneTodos.length > 0 && (
            <button className={styles.deleteDoneBtn} onClick={handleDeleteDone} disabled={deletingDone}>
              <Trash2 size={14} /> Delete done ({doneTodos.length})
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <label className={styles.controlGroup}>
          Group:
          <select
            value={groupMode}
            onChange={(e) => setGroupMode(e.target.value as GroupMode)}
            className={styles.controlSelect}
          >
            <option value="structure">Structure (Act → Scene)</option>
            <option value="scene">Scene (flat)</option>
            <option value="none">None</option>
          </select>
        </label>
        <label className={styles.controlGroup}>
          Sort:
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className={styles.controlSelect}
          >
            <option value="position">Position</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

      {/* Add form */}
      {showAddForm && (
        <AddTodoForm structure={structure} onAdd={handleAdd} onCancel={() => setShowAddForm(false)} />
      )}

      {error && <div className={styles.error}>{error}</div>}

      {/* Active todos */}
      <div className={styles.body}>
        {sortedActive.length === 0 && !showAddForm ? (
          <div className={styles.empty}>
            No active TODOs.{" "}
            <button className={styles.emptyAddBtn} onClick={() => setShowAddForm(true)}>
              Add one
            </button>
          </div>
        ) : (
          renderGrouped()
        )}
      </div>

      {/* Done section */}
      {doneTodos.length > 0 && (
        <div className={styles.doneSection}>
          <button className={styles.doneHeader} onClick={() => setDoneExpanded((v) => !v)}>
            {doneExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Done ({doneTodos.length})</span>
          </button>
          {doneExpanded && (
            <div className={styles.doneItems}>
              {sortedDone.map((t) => (
                <TodoItem
                  key={t.id}
                  todo={t}
                  showScene={groupMode === "none"}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
