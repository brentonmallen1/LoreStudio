import { useCallback, useEffect, useState } from "react";
import { Redo2, RotateCcw, Undo2 } from "lucide-react";
import { toolsApi, type ChangeRow } from "../../api/tools";
import { ApiError, MUTATION_EVENT } from "../../api/request";
import { UNDO_APPLIED_EVENT } from "../../hooks/useUndoRedo";
import { applyResult, forgetChange } from "../../stores/undoStore";
import { formatRelative } from "../../lib/utils";
import styles from "./ChangesView.module.css";

const ENTITY_LABEL: Record<string, string> = {
  structure_node: "Structure",
  character: "Character",
  character_relationship: "Relationship",
  outline_item: "Outline",
  outline: "Outline",
  story: "Story",
  location: "Location",
  note: "Note",
  todo: "To-do",
  culture: "Culture",
  world_system: "System",
  era: "Era",
  historical_event: "Event",
  calendar: "Calendar",
  compendium_entry: "Compendium",
  compendium_attachment: "Compendium",
  twist: "Twist",
  plot_thread: "Plot thread",
  plot_thread_appearance: "Plot thread",
};

interface Batch {
  batch_id: string;
  label: string;
  entity_type: string;
  created_at: string | null;
  client_id: string | null;
  rows: ChangeRow[];
  kind: "change" | "undo" | "redo" | "content";
}

function groupBatches(rows: ChangeRow[]): Batch[] {
  const out: Batch[] = [];
  for (const row of rows) {
    const last = out[out.length - 1];
    if (last && last.batch_id === row.batch_id) {
      last.rows.push(row);
      continue;
    }
    out.push({
      batch_id: row.batch_id,
      label: row.label,
      entity_type: row.entity_type,
      created_at: row.created_at,
      client_id: row.client_id,
      rows: [row],
      kind: row.undo_of ? "undo" : row.redo_of ? "redo" : row.action === "content" ? "content" : "change",
    });
  }
  return out;
}

/**
 * Chronicle › Changes: the data side of the audit trail (the AI side is the activity log).
 * Every recorded mutation, newest first, grouped by gesture, with undo/redo across all tabs,
 * and "Undo" on any one change still standing (refused while a later change stands on it).
 */
export default function ChangesView({ storyId }: { storyId: string }) {
  const [rows, setRows] = useState<ChangeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(
    async (beforeSeq?: number) => {
      const page = await toolsApi.listChanges(storyId, 100, beforeSeq);
      setRows((prev) => (beforeSeq ? [...prev, ...page] : page));
      setDone(page.length < 100);
    },
    [storyId],
  );

  async function loadOlder() {
    setLoading(true);
    try {
      await load(rows[rows.length - 1]?.seq);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Initial page inline (not via load) so nothing sets state synchronously in the effect body.
    let cancelled = false;
    toolsApi
      .listChanges(storyId, 100)
      .then((page) => {
        if (cancelled) return;
        setRows(page);
        setDone(page.length < 100);
      })
      .catch(() => {});
    const refresh = () => load().catch(() => {});
    window.addEventListener(MUTATION_EVENT, refresh);
    window.addEventListener(UNDO_APPLIED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(MUTATION_EVENT, refresh);
      window.removeEventListener(UNDO_APPLIED_EVENT, refresh);
    };
  }, [load, storyId]);

  async function run(kind: "undo" | "redo") {
    setError(null);
    try {
      const result =
        kind === "undo" ? await toolsApi.undo(storyId, true) : await toolsApi.redo(storyId, true);
      await applyResult(storyId, result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : `Could not ${kind}`);
    }
  }

  async function undoOne(batchId: string) {
    setError(null);
    try {
      const result = await toolsApi.undoChange(storyId, batchId);
      // Off ⌘Z's timeline too, and the open scene takes back its prose if this held some.
      forgetChange(batchId);
      await applyResult(storyId, result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not undo that change");
    }
  }

  const batches = groupBatches(rows);
  const undone = new Set(rows.map((r) => r.undo_of).filter(Boolean));
  const canUndo = (b: Batch) =>
    (b.kind === "change" || b.kind === "redo") && !undone.has(b.batch_id) && b.rows.every((r) => r.undoable);
  const myClient = (() => {
    try {
      return sessionStorage.getItem("ls_client_id");
    } catch {
      return null;
    }
  })();

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        {/* The page header explains this view (ChroniclePage BLURBS). */}
        <span />
        <div className={styles.actions}>
          <button
            className={styles.btn}
            onClick={() => run("undo")}
            title="Undo the latest change from any tab"
          >
            <Undo2 size={13} /> Undo latest
          </button>
          <button
            className={styles.btn}
            onClick={() => run("redo")}
            title="Redo the latest undo from any tab"
          >
            <Redo2 size={13} /> Redo
          </button>
        </div>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {batches.length === 0 && !loading && <p className={styles.empty}>No changes recorded yet.</p>}
      <ul className={styles.list}>
        {batches.map((b) => (
          <li key={b.batch_id} className={`${styles.row} ${styles[`row_${b.kind}`]}`}>
            <span className={styles.icon}>
              {b.kind === "undo" ? <RotateCcw size={12} /> : b.kind === "redo" ? <Redo2 size={12} /> : null}
            </span>
            <span className={styles.entity}>{ENTITY_LABEL[b.entity_type] ?? b.entity_type}</span>
            <span className={styles.label}>
              {b.label}
              {b.rows.length > 1 && <span className={styles.count}> · {b.rows.length} items</span>}
              {b.kind === "content" && <span className={styles.count}> · typing, undone in the scene</span>}
            </span>
            <span className={styles.meta}>
              {b.client_id && b.client_id === myClient ? "this tab" : b.client_id ? "another tab" : ""}
              {b.created_at ? ` · ${formatRelative(b.created_at)}` : ""}
            </span>
            {canUndo(b) ? (
              <button
                type="button"
                className={styles.undoOne}
                onClick={() => undoOne(b.batch_id)}
                aria-label={`Undo: ${b.label}`}
                title="Undo this change"
              >
                Undo
              </button>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
      {!done && (
        <button className={styles.btn} disabled={loading} onClick={loadOlder}>
          {loading ? "Loading…" : "Load older"}
        </button>
      )}
    </div>
  );
}
