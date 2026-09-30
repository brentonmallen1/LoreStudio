import { useAutosaveField } from "../plan/useAutosaveField";
import styles from "./Panel.module.css";

interface Props {
  label: string;
  initial: string;
  placeholder?: string;
  rows?: number;
  save: (value: string) => Promise<unknown>;
}

/** One labelled field that saves itself; key it by what it edits. */
export default function AutosaveTextarea({ label, initial, placeholder, rows = 3, save }: Props) {
  const field = useAutosaveField(initial, save);
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <textarea
        className={styles.textarea}
        rows={rows}
        value={field.value}
        placeholder={placeholder}
        onChange={(e) => field.change(e.target.value)}
        onBlur={field.flush}
      />
    </label>
  );
}
