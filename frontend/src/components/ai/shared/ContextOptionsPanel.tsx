import { useEffect, useRef } from "react";
import type { ContextOptions } from "../../../types";
import styles from "./ContextOptionsPanel.module.css";

const DEFAULT_OPTIONS: ContextOptions = {
  include_characters: true,
  include_threads: true,
  include_settings: true,
  include_siblings: true,
};

interface Props {
  options: ContextOptions | undefined;
  onChange: (opts: ContextOptions) => void;
  onClose: () => void;
}

export default function ContextOptionsPanel({ options, onChange, onClose }: Props) {
  const opts = options ?? DEFAULT_OPTIONS;
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  function toggle(key: keyof ContextOptions) {
    onChange({ ...opts, [key]: !opts[key] });
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <div className={styles.header}>Context included in AI prompt</div>

      <ToggleRow
        label="Character profiles"
        hint="Full profiles of characters @mentioned in this scene"
        checked={opts.include_characters}
        onChange={() => toggle("include_characters")}
      />
      <ToggleRow
        label="Plot threads"
        hint="Active threads touching this scene"
        checked={opts.include_threads}
        onChange={() => toggle("include_threads")}
      />
      <ToggleRow
        label="Settings"
        hint="Setting details for [[locations]] in this scene"
        checked={opts.include_settings}
        onChange={() => toggle("include_settings")}
      />
      <ToggleRow
        label="Sibling scenes"
        hint="Titles and synopses of adjacent scenes"
        checked={opts.include_siblings}
        onChange={() => toggle("include_siblings")}
      />
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>
        <span className={styles.label}>{label}</span>
        <span className={styles.hint}>{hint}</span>
      </div>
      <label className={styles.toggle}>
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className={styles.track} />
      </label>
    </div>
  );
}
