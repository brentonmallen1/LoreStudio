import { useLayoutEffect, useRef } from "react";
import { useAutosaveField } from "../plan/useAutosaveField";
import styles from "./SceneSheet.module.css";

/**
 * One of the scene's own words on the Scene sheet (doc 24 D19): text at rest, a field when
 * reached, growing with its answer, saved a moment after typing stops and on leaving. Key it
 * by the node and the field it edits.
 */
export default function SheetField({
  label,
  initial,
  placeholder,
  save,
  prose = false,
}: {
  label: string;
  initial: string;
  placeholder: string;
  save: (value: string) => Promise<unknown>;
  /** In the prose face, like the synopsis. */
  prose?: boolean;
}) {
  const field = useAutosaveField(initial, save);
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [field.value]);
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <textarea
        ref={ref}
        rows={1}
        className={`${styles.text} ${prose ? styles.prose : ""}`}
        value={field.value}
        placeholder={placeholder}
        onChange={(e) => field.change(e.target.value)}
        onBlur={field.flush}
      />
    </label>
  );
}
