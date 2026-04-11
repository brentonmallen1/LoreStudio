import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ListTree } from "lucide-react";
import { api } from "../../api/client";
import type { BeatSheet } from "../../types";
import styles from "./BeatSheetSelector.module.css";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  onInject?: (beatSheetId: string) => void;
}

export default function BeatSheetSelector({ value, onChange, onInject }: Props) {
  const [sheets, setSheets] = useState<BeatSheet[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.listBeatSheets().then(setSheets).catch(() => {});
  }, []);

  const active = sheets.find(s => s.id === value) ?? null;

  return (
    <div className={styles.wrap}>
      <select
        className={styles.select}
        value={value ?? ""}
        onChange={e => onChange(e.target.value || null)}
      >
        <option value="">— None —</option>
        {sheets.map(s => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      {active && (
        <div className={styles.preview}>
          <div className={styles.previewRow}>
            <button
              className={styles.toggleBtn}
              onClick={() => setExpanded(e => !e)}
            >
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <span>{active.beats.length} beats</span>
            </button>
            {onInject && (
              <button
                className={styles.injectBtn}
                onClick={() => onInject(active.id)}
              >
                <ListTree size={12} />
                Use as Outline
              </button>
            )}
          </div>
          {active.description && (
            <p className={styles.description}>{active.description}</p>
          )}
          {expanded && (
            <ol className={styles.beatList}>
              {active.beats.map(beat => (
                <li key={beat.id} className={styles.beatItem}>
                  <span className={styles.beatPct}>{beat.position_pct}%</span>
                  <span className={styles.beatName}>{beat.name}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
