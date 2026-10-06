import { FONT_CATEGORIES, FONT_OPTIONS, LINE_WIDTH_OPTIONS, useUIStore } from "../../stores/uiStore";
import type { EditorFontFamily, EditorFontSize } from "../../stores/uiStore";
import InterfaceSizeButtons from "./InterfaceSizeButtons";
import styles from "../../pages/Settings.module.css";

const FONT_SIZES: { value: EditorFontSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "xl", label: "X-Large" },
];

/** Interface size, then the writing's font, size and line width. */
export default function TypographySection() {
  const {
    editorFontFamily,
    setEditorFontFamily,
    editorFontSize,
    setEditorFontSize,
    editorLineWidth,
    setEditorLineWidth,
  } = useUIStore();
  return (
    <>
      <div className={styles.settingGroup}>
        <p className={styles.settingGroupLabel}>Interface size</p>
        <p className={styles.hint}>
          Menus, buttons, labels and icons. The writing keeps its own size, below.
        </p>
        <InterfaceSizeButtons
          rowClass={styles.themeRow}
          buttonClass={styles.themeOption}
          activeClass={styles.active}
        />
      </div>

      <div className={styles.settingGroup}>
        <p className={styles.settingGroupLabel}>Editor font</p>
        <select
          aria-label="Editor font"
          className={styles.fontSelect}
          value={editorFontFamily}
          onChange={(e) => setEditorFontFamily(e.target.value as EditorFontFamily)}
          style={{ fontFamily: FONT_OPTIONS.find((f) => f.value === editorFontFamily)?.stack }}
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

      <div className={styles.settingGroup}>
        <p className={styles.settingGroupLabel}>Writing size</p>
        <div className={styles.themeRow}>
          {FONT_SIZES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setEditorFontSize(value)}
              aria-pressed={editorFontSize === value}
              className={`${styles.themeOption} ${editorFontSize === value ? styles.active : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.settingGroup}>
        <p className={styles.settingGroupLabel}>Line width</p>
        <div className={styles.themeRow}>
          {LINE_WIDTH_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setEditorLineWidth(value)}
              aria-pressed={editorLineWidth === value}
              className={`${styles.themeOption} ${editorLineWidth === value ? styles.active : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
