import { useState } from "react";
import { ChevronDown, ChevronRight, ListTree, Settings2 } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import BeatSheetManagerDialog from "./BeatSheetManagerDialog";
import styles from "./BeatSheetSelector.module.css";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  onInject?: (beatSheetId: string) => void;
}

export default function BeatSheetSelector({ value, onChange, onInject }: Props) {
  const { beatSheets: sheets, setBeatSheets } = useStoryStore();
  const [expanded, setExpanded] = useState(false);
  const [showManager, setShowManager] = useState(false);

  function loadSheets() {
    api
      .listBeatSheets()
      .then(setBeatSheets)
      .catch(() => {});
  }

  const active = sheets.find((s) => s.id === value) ?? null;

  return (
    <div className={styles.wrap}>
      <div className={styles.selectRow}>
        <select
          className={styles.select}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">None</option>
          {sheets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button className={styles.manageBtn} onClick={() => setShowManager(true)} title="Manage beat sheets">
          <Settings2 size={13} />
        </button>
      </div>

      {active && (
        <div className={styles.preview}>
          <div className={styles.previewRow}>
            <button className={styles.toggleBtn} onClick={() => setExpanded((e) => !e)}>
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <span>{active.beats.length} beats</span>
            </button>
            {onInject && (
              <button className={styles.injectBtn} onClick={() => onInject(active.id)}>
                <ListTree size={12} />
                Use as Outline
              </button>
            )}
          </div>
          {active.description && <p className={styles.description}>{active.description}</p>}
          {expanded && (
            <ol className={styles.beatList}>
              {active.beats.map((beat) => (
                <li key={beat.id} className={styles.beatItem}>
                  <span className={styles.beatPct}>{beat.position_pct}%</span>
                  <span className={styles.beatName}>{beat.name}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {showManager && (
        <BeatSheetManagerDialog onClose={() => setShowManager(false)} onSheetsChanged={loadSheets} />
      )}
    </div>
  );
}
