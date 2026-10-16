import { useState } from "react";
import { X } from "lucide-react";
import {
  RELATIONSHIP_PURPOSES,
  purposeHint,
  purposeLabel,
} from "../../../lib/characters/relationshipPurposes";
import styles from "./NarrativePurposeTags.module.css";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

/**
 * What a relationship is for (doc 30 D6): the chosen purposes as chips in plain words, and a
 * menu where each one says what it means, on screen. The meaning of each chosen one sits under
 * the chips, so it is never only in a hover.
 */
export default function NarrativePurposeTags({ value, onChange }: Props) {
  const [custom, setCustom] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  function add(tag: string) {
    const t = tag.trim().toLowerCase();
    if (t && !value.includes(t)) onChange([...value, t]);
    setCustom("");
    setShowDropdown(false);
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  const available = RELATIONSHIP_PURPOSES.filter((p) => !value.includes(p.value));

  return (
    <div className={styles.root}>
      <div className={styles.chips}>
        {value.map((tag) => (
          <span key={tag} className={styles.chip}>
            {purposeLabel(tag)}
            <button
              aria-label={`Remove ${purposeLabel(tag)}`}
              className={styles.chipRemove}
              onClick={() => remove(tag)}
              type="button"
            >
              <X size={9} />
            </button>
          </span>
        ))}
        <div className={styles.addWrapper}>
          <button className={styles.addBtn} type="button" onClick={() => setShowDropdown((v) => !v)}>
            + Add purpose
          </button>
          {showDropdown && (
            <div className={styles.dropdown}>
              {available.map((p) => (
                <button
                  key={p.value}
                  className={styles.dropdownItem}
                  type="button"
                  onClick={() => add(p.value)}
                >
                  <span className={styles.itemLabel}>{p.label}</span>
                  <span className={styles.itemHint}>{p.hint}</span>
                </button>
              ))}
              <div className={styles.customRow}>
                <input
                  className={styles.customInput}
                  placeholder="Custom purpose…"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && add(custom)}
                  autoFocus
                />
                <button
                  className={styles.customAdd}
                  type="button"
                  onClick={() => add(custom)}
                  disabled={!custom.trim()}
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {value.some((t) => purposeHint(t)) && (
        <ul className={styles.meanings}>
          {value
            .filter((t) => purposeHint(t))
            .map((t) => (
              <li key={t}>
                <strong>{purposeLabel(t)}</strong>: {purposeHint(t)}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
