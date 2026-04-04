import { useState, useEffect, useRef } from "react";
import { Type } from "lucide-react";
import { useUIStore, FONT_OPTIONS, FONT_CATEGORIES, type EditorFontFamily, type EditorFontSize, type EditorLineWidth } from "../../stores/uiStore";
import styles from "./FontPicker.module.css";

const sizeOptions: { value: EditorFontSize; label: string }[] = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
  { value: "xl", label: "XL" },
];

const widthOptions: { value: EditorLineWidth; label: string }[] = [
  { value: "narrow", label: "Narrow" },
  { value: "medium", label: "Medium" },
  { value: "wide", label: "Wide" },
];

export default function FontPicker() {
  const { editorFontFamily, editorFontSize, editorLineWidth, setEditorFontFamily, setEditorFontSize, setEditorLineWidth } = useUIStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const currentFont = FONT_OPTIONS.find((f) => f.value === editorFontFamily);

  return (
    <div className={styles.root} ref={ref}>
      <button
        className={`${styles.btn} ${open ? styles.btnActive : ""}`}
        onClick={() => setOpen((o) => !o)}
        title="Font settings"
        aria-label="Font settings"
      >
        <Type size={14} />
      </button>

      {open && (
        <div className={styles.picker}>
          <div className={styles.section}>
            <span className={styles.sectionLabel}>Font</span>
            <select
              className={styles.fontSelect}
              value={editorFontFamily}
              onChange={(e) => setEditorFontFamily(e.target.value as EditorFontFamily)}
              style={{ fontFamily: currentFont?.stack }}
            >
              {FONT_CATEGORIES.map(({ value: cat, label: catLabel }) => (
                <optgroup key={cat} label={catLabel}>
                  {FONT_OPTIONS.filter((f) => f.category === cat).map(({ value, label, stack }) => (
                    <option key={value} value={value} style={{ fontFamily: stack }}>
                      {label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className={styles.divider} />

          <div className={styles.section}>
            <span className={styles.sectionLabel}>Size</span>
            <div className={styles.sizeRow}>
              {sizeOptions.map(({ value, label }) => (
                <button
                  key={value}
                  className={`${styles.sizeBtn} ${editorFontSize === value ? styles.active : ""}`}
                  onClick={() => setEditorFontSize(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.section}>
            <span className={styles.sectionLabel}>Line Width</span>
            <div className={styles.sizeRow}>
              {widthOptions.map(({ value, label }) => (
                <button
                  key={value}
                  className={`${styles.sizeBtn} ${editorLineWidth === value ? styles.active : ""}`}
                  onClick={() => setEditorLineWidth(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
