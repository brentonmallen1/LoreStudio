import { useState } from "react";
import { X } from "lucide-react";
import styles from "./AlsoCalled.module.css";

/**
 * The other names a character or place answers to in the prose ("The Keeper's Cottage" for
 * Keeper's Cottage). A mention by any of them resolves to the entry. Shown when there are
 * some, or while one is being added (the sheet's ⋯ menu starts that).
 */
export default function AlsoCalled({
  names,
  adding,
  onAdding,
  onChange,
}: {
  names: string[];
  adding: boolean;
  onAdding: (adding: boolean) => void;
  onChange: (names: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  if (!names.length && !adding) return null;

  function commit() {
    const name = draft.trim();
    if (name && !names.some((n) => n.toLowerCase() === name.toLowerCase())) onChange([...names, name]);
    setDraft("");
    onAdding(false);
  }

  return (
    <div className={styles.row}>
      <span className={styles.label}>Also called</span>
      {names.map((n) => (
        <span key={n} className={styles.chip}>
          {n}
          <button
            type="button"
            className={styles.remove}
            aria-label={`Remove the name ${n}`}
            title="Mentions by this name will no longer find this entry"
            onClick={() => onChange(names.filter((x) => x !== n))}
          >
            <X size={11} aria-hidden />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          className={styles.input}
          value={draft}
          placeholder="Another name"
          aria-label="Another name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft("");
              onAdding(false);
            }
          }}
        />
      ) : (
        <button type="button" className={styles.add} onClick={() => onAdding(true)}>
          + Another
        </button>
      )}
    </div>
  );
}
