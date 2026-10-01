import { useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Plus, Search } from "lucide-react";
import type { ListItem } from "../../lib/lorebook/rows";
import styles from "./Lorebook.module.css";

export type { ListItem };

/**
 * The middle column of a Lorebook section (doc 12 P2): Add at the top where it is seen, a
 * find box once the list is long enough to need one, the entries, ↑↓ to move between them.
 * A tree (places) folds; a parent's rows hide with it.
 */
export default function LorebookList({
  title,
  items,
  selectedId,
  onSelect,
  onAdd,
  addLabel = "Add",
  secondaryAdd,
  footer,
  empty,
}: {
  title: string;
  items: ListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  addLabel?: string;
  /** A second kind of thing to add here (an era beside its events). */
  secondaryAdd?: { label: string; onClick: () => void };
  footer?: ReactNode;
  empty?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      return items.filter((i) => !i.heading && i.name.toLowerCase().includes(needle));
    }
    const out: ListItem[] = [];
    let hideBelow: number | null = null;
    for (const item of items) {
      const depth = item.depth ?? 0;
      if (hideBelow !== null && depth > hideBelow) continue;
      hideBelow = null;
      out.push(item);
      if (item.hasChildren && folded.has(item.id)) hideBelow = depth;
    }
    return out;
  }, [items, q, folded]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = visible.filter((i) => !i.heading);
    if (!rows.length) return;
    e.preventDefault();
    const at = rows.findIndex((i) => i.id === selectedId);
    const next = e.key === "ArrowDown" ? Math.min(rows.length - 1, at + 1) : Math.max(0, at - 1);
    onSelect(rows[next].id);
    requestAnimationFrame(() =>
      listRef.current?.querySelector<HTMLButtonElement>(`[data-id="${rows[next].id}"]`)?.focus(),
    );
  }

  const entries = items.filter((i) => !i.heading).length;
  return (
    <div className={styles.list}>
      <div className={styles.listHeader}>
        <span className={styles.listTitle}>
          {title} <span className={styles.listCount}>{entries}</span>
        </span>
        {secondaryAdd && (
          <button type="button" className={styles.listAddQuiet} onClick={secondaryAdd.onClick}>
            <Plus size={12} aria-hidden />
            {secondaryAdd.label}
          </button>
        )}
        {onAdd && (
          <button type="button" className={styles.listAdd} onClick={onAdd}>
            <Plus size={12} aria-hidden />
            {addLabel}
          </button>
        )}
      </div>
      {entries > 7 && (
        <label className={styles.listFind}>
          <Search size={12} aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Find in ${title.toLowerCase()}…`}
            aria-label={`Find in ${title}`}
          />
        </label>
      )}
      <div ref={listRef} className={styles.listRows} role="listbox" aria-label={title} onKeyDown={onKeyDown}>
        {entries === 0 && empty}
        {visible.map((item) =>
          item.heading ? (
            <div key={item.id} className={styles.listHeading}>
              {item.name}
              {item.sub && <span className={styles.listHeadingSub}>{item.sub}</span>}
            </div>
          ) : (
            <div key={item.id} className={styles.listRowWrap} style={{ paddingLeft: (item.depth ?? 0) * 16 }}>
              {item.hasChildren && !q ? (
                <button
                  type="button"
                  className={styles.fold}
                  aria-label={folded.has(item.id) ? `Show what is in ${item.name}` : `Fold ${item.name}`}
                  onClick={() =>
                    setFolded((f) => {
                      const next = new Set(f);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    })
                  }
                >
                  {folded.has(item.id) ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </button>
              ) : (
                <span className={styles.foldSpace} aria-hidden />
              )}
              <button
                type="button"
                role="option"
                aria-selected={item.id === selectedId}
                data-id={item.id}
                className={`${styles.listRow} ${item.id === selectedId ? styles.listRowOn : ""}`}
                onClick={() => onSelect(item.id)}
              >
                {item.dot !== undefined && (
                  <span
                    className={styles.rowDot}
                    style={item.dot ? { background: item.dot, borderColor: item.dot } : undefined}
                    aria-hidden
                  />
                )}
                <span className={styles.listRowText}>
                  <span className={styles.listRowName}>{item.name}</span>
                  {item.sub && <span className={styles.listRowSub}>{item.sub}</span>}
                </span>
                {item.flag && <span className={styles.flag} title={item.flag} aria-label={item.flag} />}
              </button>
            </div>
          ),
        )}
      </div>
      {footer}
    </div>
  );
}
