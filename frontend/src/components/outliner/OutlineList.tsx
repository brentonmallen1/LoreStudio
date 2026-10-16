import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { Plus } from "lucide-react";
import { outlineKey, type Field, type KeyAction } from "../../lib/outline/keys";
import { dropSpot } from "../../lib/outline/place";
import { loadFolded, saveFolded } from "../../lib/outline/prefs";
import {
  DRAFT_ID,
  indent,
  indentSpot,
  leafDepth,
  levelType,
  moveTo,
  nextSpot,
  outdent,
  outdentSpot,
  placeOf,
  rowBefore,
  shapeOf,
  visibleRows,
  type Row,
  type Spot,
} from "../../lib/outline/tree";
import { useStoryStore } from "../../stores/storyStore";
import type { StructureNode } from "../../types";
import OutlineRow from "./OutlineRow";
import { useOutlineActions } from "./useOutlineActions";
import { ideaDrag, useTrayContext } from "./useTray";
import styles from "./Outline.module.css";

type At = Field | "row";
interface Draft {
  spot: Spot;
  /** Lines it will hold once saved: the ones after it when Shift+Tab moved it out. */
  adopt: string[];
  n: number;
}

/**
 * The Outline as a list (doc 29 D2): the acts, chapters and scenes as lines to type, with the
 * keys of an outliner (`lib/outline/keys`) and the shape's rules (`lib/outline/tree`). A new
 * line is kept here until it has words in it, so an Enter pressed by mistake leaves nothing
 * behind; everything saved goes through the structure routes and undoes with ⌘Z.
 */
export default function OutlineList({
  storyId,
  startAfter,
  reveal,
}: {
  storyId: string;
  startAfter?: string | null;
  /** A scene to show, unfolded, from a pattern's moment card ("Open in the Outline"). */
  reveal?: { id: string; n: number } | null;
}) {
  const structure = useStoryStore((s) => s.structure);
  const template = useStoryStore((s) => s.activeTemplate);
  const shape = useMemo(() => shapeOf(template), [template]);
  const actions = useOutlineActions(storyId);
  const tray = useTrayContext();
  const [folded, setFolded] = useState(() => loadFolded(storyId));
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  // From the empty Outline: its first line is saved, and the next is ready to type.
  const [draft, setDraft] = useState<Draft | null>(() => {
    const spot = startAfter ? nextSpot(structure, startAfter, new Set(), shape) : null;
    return spot ? { spot, adopt: [], n: 0 } : null;
  });
  const [notice, setNotice] = useState("");
  const [stopId, setStopId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; zone: "above" | "below" | "into" } | null>(null);
  const drag = useRef<{ id: string; depth: number } | null>(null);
  // Each new line's number, and the one being saved: a blur that comes after Enter or Esc
  // has already saved it must not save it again.
  const serial = useRef(0);
  const saving = useRef<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const pending = useRef<{ id: string; at: At; caret?: "start" | "end" } | null>(
    startAfter ? { id: DRAFT_ID, at: "title" } : null,
  );
  const busy = useRef(false);

  const rows = visibleRows(structure, folded, shape);
  const shown: Row[] = draft ? withDraft(rows, structure, draft, folded, shape) : rows;
  const stop = shown.some((r) => r.node.id === stopId) ? stopId : (shown[0]?.node.id ?? null);

  const find = (id: string, at: At) =>
    box.current?.querySelector<HTMLElement>(
      at === "row" ? `[data-outline-row="${id}"]` : `[data-outline-line="${id}"][data-field="${at}"]`,
    ) ?? null;
  const value = (id: string, at: Field) => (find(id, at) as HTMLInputElement | null)?.value ?? "";

  function focusNow() {
    const want = pending.current;
    const el = want && find(want.id, want.at);
    if (!want || !el) return;
    pending.current = null;
    el.focus();
    if (el instanceof HTMLInputElement) {
      const at = want.caret === "start" ? 0 : el.value.length;
      el.setSelectionRange(at, at);
    }
  }
  // What a key asked to focus, once the rows it needs are drawn.
  useLayoutEffect(focusNow);
  // "Open in the Outline" from a moment card: the parts above it unfolded, the scene open,
  // worked out as the request arrives (not in an effect), then the row scrolled to.
  const [revealed, setRevealed] = useState(0);
  if (reveal && reveal.n !== revealed) {
    setRevealed(reveal.n);
    const ups: string[] = [];
    for (let at = placeOf(structure, reveal.id); at?.parent; at = placeOf(structure, at.parent.id))
      ups.push(at.parent.id);
    if (ups.some((id) => folded.has(id))) {
      const next = new Set([...folded].filter((id) => !ups.includes(id)));
      saveFolded(storyId, next);
      setFolded(next);
    }
    if (!open.has(reveal.id)) setOpen(new Set(open).add(reveal.id));
  }
  useLayoutEffect(() => {
    if (!revealed || !reveal) return;
    const row = find(reveal.id, "row");
    row?.scrollIntoView({ block: "center" });
    row?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per reveal asked for
  }, [revealed]);
  const focusOn = (id: string, at: At, caret?: "start" | "end") => {
    pending.current = { id, at, caret };
    focusNow();
  };

  function setFold(id: string, fold: boolean) {
    setFolded((prev) => {
      if (prev.has(id) === fold) return prev;
      const next = new Set(prev);
      if (fold) next.add(id);
      else next.delete(id);
      saveFolded(storyId, next);
      return next;
    });
  }

  function toggle(id: string) {
    const at = placeOf(structure, id);
    if (at && at.node.children?.length) return setFold(id, !folded.has(id));
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** A saved line's title and what happens, sent when they changed. */
  function commit(id: string) {
    if (id === DRAFT_ID) return;
    const node = placeOf(useStoryStore.getState().structure, id)?.node;
    if (!node) return;
    const title = value(id, "title").trim();
    const synopsis = value(id, "synopsis").trim();
    const fields: Partial<Pick<StructureNode, "title" | "synopsis">> = {};
    if (title && title !== node.title) fields.title = title;
    if (synopsis !== (node.synopsis ?? "").trim()) fields.synopsis = synopsis;
    if (Object.keys(fields).length) void actions.save(id, fields);
  }

  /** The new line saved, when it has words; dropped when it has none. */
  async function commitDraft(): Promise<StructureNode | null> {
    const d = draft;
    if (!d || saving.current === d.n) return null;
    saving.current = d.n;
    const title = value(DRAFT_ID, "title").trim();
    const synopsis = value(DRAFT_ID, "synopsis").trim();
    if (!title && !synopsis) {
      setDraft(null);
      return null;
    }
    busy.current = true;
    try {
      const node = await actions.add({
        parentId: d.spot.parentId,
        depth: d.spot.depth,
        position: d.spot.position,
        levelType: levelType(shape, d.spot.depth),
        title: title || "Untitled",
        synopsis,
        scene: d.spot.depth >= leafDepth(shape),
      });
      if (node && d.adopt.length)
        await actions.reorder(d.adopt.map((id, i) => ({ node_id: id, parent_id: node.id, position: i })));
      setDraft(null);
      return node;
    } finally {
      busy.current = false;
    }
  }

  function newLine(spot: Spot | null, adopt: string[] = []) {
    if (!spot) return;
    if (spot.parentId) setFold(spot.parentId, false);
    const n = ++serial.current;
    setDraft({ spot, adopt, n });
    setNotice("");
    pending.current = { id: DRAFT_ID, at: "title" };
  }

  async function levelMove(id: string, at: At, which: "indent" | "outdent") {
    const tree = useStoryStore.getState().structure;
    const move = which === "indent" ? indent(tree, id, shape) : outdent(tree, id, shape);
    if ("refused" in move) return setNotice(move.refused);
    setNotice("");
    const parent = placeOf(move.tree, id)?.parent;
    if (parent) setFold(parent.id, false);
    pending.current = { id, at, caret: "end" };
    await actions.apply(move);
  }

  async function draftLevel(at: At, which: "indent" | "outdent") {
    if (!draft) return;
    if (value(DRAFT_ID, "title").trim() || value(DRAFT_ID, "synopsis").trim()) {
      const node = await commitDraft();
      if (node) await levelMove(node.id, at, which);
      return;
    }
    const tree = useStoryStore.getState().structure;
    const moved =
      which === "indent"
        ? indentSpot(tree, draft.spot, shape)
        : (() => {
            const out = outdentSpot(tree, draft.spot, shape);
            return "refused" in out ? out : { ...out.spot, adopt: out.adopt };
          })();
    if ("refused" in moved) return setNotice(moved.refused);
    const { adopt = [], ...spot } = moved as Spot & { adopt?: string[] };
    newLine(spot, adopt);
  }

  async function run(action: KeyAction, id: string, at: At) {
    const isDraft = id === DRAFT_ID;
    const index = shown.findIndex((r) => r.node.id === id);
    const field: At = at === "row" ? "row" : at;
    if (action === "up" || action === "down") {
      const target = shown[index + (action === "up" ? -1 : 1)];
      if (!target) return;
      busy.current = isDraft;
      focusOn(target.node.id, field === "synopsis" ? "synopsis" : field, "end");
      if (isDraft) await commitDraft();
      else commit(id);
      return;
    }
    if (action === "add-next") {
      if (isDraft) {
        const node = await commitDraft();
        if (node) newLine(nextSpot(useStoryStore.getState().structure, node.id, folded, shape));
        return;
      }
      commit(id);
      return newLine(nextSpot(useStoryStore.getState().structure, id, folded, shape));
    }
    if (action === "indent" || action === "outdent") {
      if (isDraft) return draftLevel(at, action);
      commit(id);
      return levelMove(id, at, action);
    }
    if (action === "to-row") {
      if (isDraft) {
        busy.current = true;
        const node = await commitDraft();
        const back = node?.id ?? shown[index - 1]?.node.id;
        if (back) focusOn(back, "row");
        return;
      }
      commit(id);
      return focusOn(id, "row");
    }
    if (action === "to-title") return focusOn(id, "title", "end");
    if (action === "to-synopsis") return focusOn(id, "synopsis", "start");
    if (action === "edit") return focusOn(id, "title", "end");
    if (action === "fold" || action === "unfold") {
      const node = placeOf(structure, id)?.node;
      if (node?.children?.length) return setFold(id, action === "fold");
      if (open.has(id) === (action === "fold")) toggle(id);
      return;
    }
    if (action === "remove-empty") {
      const before = shown[index - 1]?.node.id;
      if (isDraft) {
        setDraft(null);
        if (before) focusOn(before, "title", "end");
        return;
      }
      const node = placeOf(structure, id)?.node;
      if (!node || node.word_count || node.synopsis || node.children?.length) return;
      if (before) pending.current = { id: before, at: "title", caret: "end" };
      await actions.remove(id);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const rowEl = target.closest<HTMLElement>("[data-outline-row]");
    if (!rowEl) return;
    const field = target.dataset.field as Field | undefined;
    const at: At | null = field ?? (target === rowEl ? "row" : null);
    if (!at) return;
    const input = field ? (target as HTMLInputElement) : null;
    const action = outlineKey({
      key: e.key,
      shift: e.shiftKey,
      mod: e.metaKey || e.ctrlKey || e.altKey,
      composing: e.nativeEvent.isComposing,
      at,
      caretStart: input ? input.selectionStart === 0 && input.selectionEnd === 0 : undefined,
      caretEnd: input ? input.selectionStart === input.value.length : undefined,
      empty: input ? input.value === "" : undefined,
    });
    if (!action) return;
    e.preventDefault();
    void run(action, rowEl.dataset.outlineRow!, at);
  }

  function onBlurLine(id: string, e: FocusEvent) {
    // A line that went away with its focus (a new line drawn in its place) has nothing to save.
    if (busy.current || !(e.target as Node).isConnected) return;
    const row = find(id, "row");
    if (row && e.relatedTarget && row.contains(e.relatedTarget as Node)) return;
    if (id === DRAFT_ID) void commitDraft();
    else commit(id);
  }

  function onDragStart(e: DragEvent, id: string) {
    const at = placeOf(structure, id);
    if (!at) return;
    drag.current = { id, depth: at.depth };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", at.node.title);
    const row = find(id, "row");
    if (row) e.dataTransfer.setDragImage(row, 12, 12);
  }

  function zoneFor(e: DragEvent, row: Row): "above" | "below" | "into" | null {
    if (ideaDrag.get() && !drag.current) return ideaZone(e, row);
    const from = drag.current;
    if (!from || row.node.id === from.id || row.node.id === DRAFT_ID) return null;
    if (row.depth === from.depth - 1 && !row.scene) return "into";
    if (row.depth !== from.depth) return null;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return e.clientY - rect.top < rect.height / 2 ? "above" : "below";
  }

  function onDragOver(e: DragEvent, row: Row) {
    const zone = zoneFor(e, row);
    if (!zone) return;
    e.preventDefault();
    if (drop?.id !== row.node.id || drop.zone !== zone) setDrop({ id: row.node.id, zone });
  }

  /** An idea from the tray: above or below a scene, or into a part that holds scenes. */
  function ideaZone(e: DragEvent, row: Row): "above" | "below" | "into" | null {
    if (row.node.id === DRAFT_ID) return null;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const zone = row.scene ? (e.clientY - rect.top < rect.height / 2 ? "above" : "below") : "into";
    return dropSpot(structure, shape, row.node.id, zone) ? zone : null;
  }

  function onDrop(e: DragEvent, row: Row) {
    const idea = ideaDrag.get();
    if (idea && tray && !drag.current) {
      const zone = ideaZone(e, row);
      const spot = zone && dropSpot(structure, shape, row.node.id, zone);
      ideaDrag.set(null);
      setDrop(null);
      if (!spot) return;
      e.preventDefault();
      if (spot.parentId) setFold(spot.parentId, false);
      void tray.place(idea.id, spot);
      return;
    }
    const zone = zoneFor(e, row);
    const from = drag.current;
    drag.current = null;
    setDrop(null);
    if (!zone || !from) return;
    e.preventDefault();
    const move = moveTo(structure, from.id, row.node.id, zone, shape);
    if ("refused" in move) return setNotice(move.refused);
    if (zone === "into") setFold(row.node.id, false);
    void actions.apply(move);
  }

  const top = shape.names[0] ?? "Part";
  return (
    <div className={styles.listWrap}>
      <div
        ref={box}
        role="tree"
        aria-label="Outline"
        className={styles.list}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          const id = (e.target as HTMLElement).closest<HTMLElement>("[data-outline-row]")?.dataset.outlineRow;
          if (id && id !== DRAFT_ID && id !== stopId) setStopId(id);
        }}
        onDragEnd={() => {
          drag.current = null;
          setDrop(null);
        }}
      >
        {shown.map((row) => (
          <OutlineRow
            key={row.node.id === DRAFT_ID ? `${DRAFT_ID}:${draft?.n}` : row.node.id}
            row={row}
            shape={shape}
            storyId={storyId}
            stop={row.node.id === stop}
            folded={folded.has(row.node.id)}
            open={open.has(row.node.id)}
            dropZone={drop?.id === row.node.id ? drop.zone : undefined}
            onToggle={toggle}
            onBlurLine={onBlurLine}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
        ))}
      </div>
      <p className={styles.notice} role="status" aria-live="polite">
        {notice}
      </p>
      <div className={styles.listFoot}>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => newLine({ parentId: null, depth: 0, position: structure.length })}
        >
          <Plus size={13} aria-hidden /> Add {/^[aeiou]/i.test(top) ? "an" : "a"} {top.toLowerCase()}
        </button>
        <span className={styles.keys}>
          Enter adds the next line · Tab tucks it under the one above · Shift+Tab moves it out · → at the end
          of a title goes on to what happens · drag ⋮⋮ to reorder
        </span>
      </div>
    </div>
  );
}

/** The rows with the new line among them, where it will be saved. */
function withDraft(
  rows: Row[],
  tree: StructureNode[],
  draft: Draft,
  folded: Set<string>,
  shape: ReturnType<typeof shapeOf>,
): Row[] {
  const before = rowBefore(tree, draft.spot, folded);
  const line: Row = {
    node: {
      id: DRAFT_ID,
      title: "",
      synopsis: "",
      word_count: 0,
      children: [],
      status: "planned",
      level: draft.spot.depth,
    } as unknown as StructureNode,
    depth: draft.spot.depth,
    scene: draft.spot.depth >= leafDepth(shape),
  };
  if (before === null) return [line, ...rows];
  const at = rows.findIndex((r) => r.node.id === before);
  return at < 0 ? [...rows, line] : [...rows.slice(0, at + 1), line, ...rows.slice(at + 1)];
}
