import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { inPatternOrder } from "../../lib/patterns";
import { useActiveSheet } from "./usePattern";
import styles from "./Pattern.module.css";

/**
 * The Outline's Pattern control (doc 29 D5, B-BeatPicker): "Show a classic pattern on your
 * Outline". None, the classic patterns by their plain names, then any the writer made, each
 * with its line. Choosing one sets the story's beat sheet, the same field Story identity and
 * the pattern walks set; it changes nothing in the story, only what the Outline shows.
 */
export default function PatternPicker() {
  const { sheet, sheets, choose } = useActiveSheet();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const options = [
    { id: "", name: "None", line: "Just your own outline" },
    ...inPatternOrder(sheets).map((s) => ({
      id: s.id,
      name: s.name,
      line: s.description || `${s.beats.length} moments, each where it tends to fall.`,
    })),
  ];

  return (
    <div className={styles.pickerWrap} ref={wrap}>
      <button
        ref={button}
        type="button"
        className={styles.pickerButton}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        Pattern: {sheet ? sheet.name : "none"}
        <ChevronDown size={13} aria-hidden />
      </button>
      {open && (
        <div
          className={styles.picker}
          role="dialog"
          aria-label="Show a classic pattern on your Outline"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(false);
              button.current?.focus();
            }
          }}
        >
          <h2 className={styles.pickerTitle}>Show a classic pattern on your Outline</h2>
          <p className={styles.pickerWhy}>
            A pattern is a list of moments many stories share, and roughly where each one falls. Turning one
            on doesn't change your story. It tags your Outline, so you can see which moments you have and
            which you might want.
          </p>
          <div className={styles.options} role="radiogroup" aria-label="Classic pattern">
            {options.map((o) => (
              <label
                key={o.id || "none"}
                className={styles.option}
                data-on={(sheet?.id ?? "") === o.id || undefined}
              >
                <input
                  type="radio"
                  name="pattern"
                  checked={(sheet?.id ?? "") === o.id}
                  onChange={() => {
                    void choose(o.id || null);
                    setOpen(false);
                    button.current?.focus();
                  }}
                />
                <span className={styles.optionText}>
                  <strong>{o.name}</strong>
                  <span>{o.line}</span>
                </span>
              </label>
            ))}
          </div>
          <Link to="/guides/structure#classic-patterns" className={styles.pickerLink}>
            What are these patterns for?
          </Link>
        </div>
      )}
    </div>
  );
}
