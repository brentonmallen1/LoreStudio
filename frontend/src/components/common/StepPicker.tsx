import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import styles from "./StepPicker.module.css";

export interface PickerItem {
  id: string;
  label: string;
  /** A quiet word at the row's end ("How is it told?"). */
  hint?: string;
  /** Marked done with a check in place of its number. */
  done?: boolean;
}

/**
 * A list of steps or sections as one dropdown, for a narrow container where a column of them
 * would scroll sideways (A2: the First story guide's steps beside the prose, Plan's steps; A4: Story
 * identity's "Jump to"). The button names where you are; the list shows every item, its done
 * mark and the current one. ↑↓ move, Enter chooses, Escape closes.
 */
export default function StepPicker({
  label,
  items,
  current,
  onSelect,
  lead,
  numbered = false,
  progress,
  className,
}: {
  /** The list's accessible name ("Steps", "Sections"). */
  label: string;
  items: PickerItem[];
  current: number;
  onSelect: (index: number) => void;
  /** Before the current item's name on the button: "Step 3 of 7 ·", "Jump to". */
  lead?: ReactNode;
  /** Draw each item's number (a step) rather than nothing (a section). */
  numbered?: boolean;
  /** 0 to 1: a thin bar under the closed button. */
  progress?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const here = items[current];

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(i: number) {
    setOpen(false);
    button.current?.focus();
    onSelect(i);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
      return;
    }
    if (!open || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    e.preventDefault();
    const opts = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const at = opts.indexOf(document.activeElement as HTMLButtonElement);
    const next = (at + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length;
    opts[next]?.focus();
  }

  if (!here) return null;
  return (
    <div ref={wrap} className={`${styles.wrap} ${className ?? ""}`} onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        className={styles.button}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.line}>
          {numbered && <span className={`${styles.badge} ${styles.badgeOn}`}>{current + 1}</span>}
          <span className={styles.name}>
            {lead && <span className={styles.lead}>{lead} </span>}
            <strong>{here.label}</strong>
          </span>
          {open ? <ChevronUp size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
        </span>
        {progress !== undefined && !open && (
          <span className={styles.track} aria-hidden>
            <span
              className={styles.fill}
              style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
            />
          </span>
        )}
      </button>
      {open && (
        <ul ref={list} id={listId} role="listbox" aria-label={label} className={styles.list}>
          {items.map((item, i) => (
            <li key={item.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={i === current}
                className={`${styles.option} ${i === current ? styles.optionOn : ""}`}
                onClick={() => choose(i)}
              >
                {(numbered || item.done !== undefined) && (
                  <span className={item.done ? styles.mark : styles.num}>
                    {item.done ? <Check size={13} aria-label="done" /> : numbered ? i + 1 : null}
                  </span>
                )}
                <span className={styles.optionLabel}>{item.label}</span>
                {item.hint && <span className={styles.hint}>{item.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
