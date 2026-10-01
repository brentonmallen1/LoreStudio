import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import styles from "./Lorebook.module.css";

export interface RowColumn<T> {
  key: keyof T & string;
  label: string;
  placeholder?: string;
  number?: boolean;
  /** Relative width; default 1. */
  grow?: number;
}

/**
 * A short list of small records inside a sheet: a system's tiers, a calendar's months and
 * special days, an era's key figures. Edits save the whole list a moment after typing stops,
 * the way the other fields do. Empty, it is one quiet "Add" button, not an empty table.
 */
export default function RowsEditor<T extends object>({
  entityKey,
  title,
  rows,
  columns,
  blank,
  addLabel,
  save,
}: {
  entityKey: string;
  title: string;
  rows: T[];
  columns: RowColumn<T>[];
  blank: () => T;
  addLabel: string;
  save: (rows: T[]) => Promise<unknown>;
}) {
  const [local, setLocal] = useState<T[]>(rows);
  const [lastKey, setLastKey] = useState(entityKey);
  if (lastKey !== entityKey) {
    setLastKey(entityKey);
    setLocal(rows);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The save travels with the edit: flushed after the sheet has moved on, it still goes to
  // the entry it was typed into.
  const pending = useRef<{ rows: T[]; save: (rows: T[]) => Promise<unknown> } | null>(null);
  const flush = () => {
    clearTimeout(timer.current);
    const p = pending.current;
    pending.current = null;
    if (p) void p.save(p.rows);
  };
  useEffect(() => flush, [entityKey]);

  function change(next: T[], now = false) {
    setLocal(next);
    pending.current = { rows: next, save };
    clearTimeout(timer.current);
    if (now) flush();
    else timer.current = setTimeout(flush, 600);
  }

  if (local.length === 0) {
    return (
      <button type="button" className={styles.quietBtn} onClick={() => change([blank()], true)}>
        <Plus size={11} aria-hidden />
        {addLabel}
      </button>
    );
  }

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>
        {title} · {local.length}
      </span>
      <div className={styles.rows}>
        {local.map((row, i) => (
          <div key={i} className={styles.rowEdit}>
            {columns.map((c) => (
              <input
                key={c.key}
                style={c.number ? undefined : { flex: c.grow ?? 1 }}
                type={c.number ? "number" : "text"}
                aria-label={`${c.label} ${i + 1}`}
                placeholder={c.placeholder ?? c.label}
                value={String((row as Record<string, unknown>)[c.key] ?? "")}
                onChange={(e) =>
                  change(
                    local.map((r, j) =>
                      j === i
                        ? { ...r, [c.key]: c.number ? Number(e.target.value) || 0 : e.target.value }
                        : r,
                    ),
                  )
                }
              />
            ))}
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={`Remove ${title.toLowerCase()} ${i + 1}`}
              onClick={() =>
                change(
                  local.filter((_, j) => j !== i),
                  true,
                )
              }
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className={styles.quietBtn} onClick={() => change([...local, blank()], true)}>
        <Plus size={11} aria-hidden />
        {addLabel}
      </button>
    </div>
  );
}
