import { useEffect, useRef, useState } from "react";
import { ChevronDown, GitCompareArrows } from "lucide-react";
import type { NumbersCompare } from "../../hooks/useNumbersCompare";
import { quickChoices, readingName, versions, when } from "../../lib/numbers/readings";
import type { ReadingSummary } from "../../types/numbers";
import styles from "./Compare.module.css";

/**
 * Compare ▾ in the Numbers header (doc 19 P4): what to compare from (this session, last
 * session, a week or a month ago, a version, any earlier reading) and what to compare it to,
 * now by default. Each choice names its date and its word count, so the author knows what
 * they are picking before they pick it.
 */
export default function ComparePicker({ compare }: { compare: NumbersCompare }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const { readings, fromId, toId, choose, backfillJob } = compare;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (id: string) => {
    choose(id, toId && toId !== id ? toId : null);
    setOpen(false);
    button.current?.focus();
  };
  const row = (key: string, name: string, r: ReadingSummary | null) => (
    <button
      key={key}
      type="button"
      role="menuitemradio"
      aria-checked={!!r && r.id === fromId}
      className={styles.option}
      disabled={!r}
      onClick={() => r && pick(r.id)}
    >
      <span className={styles.optionName}>{name}</span>
      <span className={styles.optionWhen}>{r ? when(r.taken_at) : "No history that far back yet"}</span>
      <span className={styles.optionWords}>{r ? `${r.words.toLocaleString()} words` : ""}</span>
    </button>
  );
  const earlier = [...readings].reverse();

  return (
    <div
      ref={wrap}
      className={styles.pickerWrap}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className={styles.pickerButton}
        data-on={fromId ? true : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={readings.length === 0}
        title={readings.length === 0 ? "No history yet: the numbers keep one from today" : "Compare with…"}
        onClick={() => setOpen((v) => !v)}
      >
        <GitCompareArrows size={14} aria-hidden />
        {fromId ? "Comparing" : "Compare"}
        <ChevronDown size={13} aria-hidden />
      </button>
      {open && (
        <div className={styles.popover} role="menu" aria-label="Compare with">
          <div className={styles.group}>Compare with</div>
          {quickChoices(readings).map((c) => row(c.id, c.name, c.reading))}
          {versions(readings).length > 0 && <div className={styles.group}>Versions</div>}
          {versions(readings).map((r) => row(`v-${r.id}`, r.label ?? "", r))}
          <details className={styles.earlier}>
            <summary>Every reading ({readings.length})</summary>
            <div className={styles.earlierList}>
              {earlier.map((r) => row(`e-${r.id}`, readingName(r), r))}
            </div>
          </details>
          {fromId && (
            <label className={styles.against}>
              Against
              <select value={toId ?? ""} onChange={(e) => choose(fromId, e.target.value || null)}>
                <option value="">Now</option>
                {earlier
                  .filter((r) => r.id !== fromId)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {readingName(r)} · {when(r.taken_at)}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {backfillJob && (
            <p className={styles.note} role="status">
              Measuring earlier versions…{" "}
              {backfillJob.total > 0 ? `${backfillJob.progress} of ${backfillJob.total}` : ""}
            </p>
          )}
          {fromId && (
            <button
              type="button"
              className={styles.off}
              onClick={() => {
                choose(null);
                setOpen(false);
              }}
            >
              Stop comparing
            </button>
          )}
        </div>
      )}
    </div>
  );
}
