import {
  useUIStore,
  FONT_OPTIONS,
  FONT_CATEGORIES,
  LINE_WIDTH_OPTIONS,
  type EditorFontFamily,
  type EditorFontSize,
} from "../../stores/uiStore";
import styles from "./FontSettings.module.css";

const sizeOptions: { value: EditorFontSize; label: string }[] = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
  { value: "xl", label: "XL" },
];

/** The prose's font, size and line width: a pane of the editor's menu (doc 14 Q1). */
export default function FontSettings() {
  const {
    editorFontFamily,
    editorFontSize,
    editorLineWidth,
    setEditorFontFamily,
    setEditorFontSize,
    setEditorLineWidth,
    highlightDialogue,
    setHighlightDialogue,
  } = useUIStore();
  const currentFont = FONT_OPTIONS.find((f) => f.value === editorFontFamily);

  return (
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
        <span className={styles.sectionLabel}>Line width</span>
        <div className={styles.sizeRow}>
          {LINE_WIDTH_OPTIONS.map(({ value, label }) => (
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

      <div className={styles.divider} />

      <label className={styles.toggleRow}>
        <input
          type="checkbox"
          checked={highlightDialogue}
          onChange={(e) => setHighlightDialogue(e.target.checked)}
        />
        <span>
          Highlight dialogue
          <span className={styles.toggleHint}>Tint quotes by attribution while you write</span>
        </span>
      </label>
    </div>
  );
}
