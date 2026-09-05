import { useState } from "react";
import { X } from "lucide-react";
import styles from "./NarrativePurposeTags.module.css";

const PRESET_PURPOSES = [
  "conflict-driver",
  "ally",
  "foil",
  "growth-catalyst",
  "emotional-anchor",
  "twist-setup",
  "comic-relief",
  "exposition-vehicle",
  "obstacle",
  "mirror",
  "wisdom-source",
  "past-connection",
  "structure-provider",
];

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  required?: boolean;
  error?: boolean;
}

export default function NarrativePurposeTags({ value, onChange, error }: Props) {
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

  const available = PRESET_PURPOSES.filter((p) => !value.includes(p));

  return (
    <div className={`${styles.root} ${error ? styles.error : ""}`}>
      <div className={styles.chips}>
        {value.map((tag) => (
          <span key={tag} className={styles.chip}>
            {tag}
            <button className={styles.chipRemove} onClick={() => remove(tag)} type="button">
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
                <button key={p} className={styles.dropdownItem} type="button" onClick={() => add(p)}>
                  {p}
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
      {error && <p className={styles.errorMsg}>At least one narrative purpose is required</p>}
    </div>
  );
}
