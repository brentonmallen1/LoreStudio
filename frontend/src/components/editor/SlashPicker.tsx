import { useEffect, useRef } from "react";
import type { SlashState } from "./useSlashCommands";
import { clampPopup } from "./segmentMeta";
import { helper } from "../../lib/typing/helpers";
import { ways } from "../../lib/typing/show";
import styles from "./SceneEditor.module.css";

export function SlashPicker({ slash }: { slash: SlashState }) {
  const chosen = useRef<HTMLButtonElement | null>(null);
  // The arrow keys move through a list taller than the box: keep the chosen one in sight.
  useEffect(() => {
    chosen.current?.scrollIntoView({ block: "nearest" });
  }, [slash.selIdx, slash.query]);
  if (!slash.open) return null;
  const matching = slash.matching;
  if (!matching.length) return null;
  return (
    <div className={styles.slashDropdown} style={clampPopup(slash.pos.bottom, slash.pos.left, 320, 300)}>
      <p className={styles.slashDropdownHint}>Slash commands</p>
      {matching.map((cmd, idx) => (
        <button
          key={cmd.name}
          ref={idx === slash.selIdx ? chosen : undefined}
          className={`${styles.slashItem} ${idx === slash.selIdx ? styles.slashItemSelected : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            if (slash.range) slash.execute(cmd.name, slash.range.from, slash.range.to);
          }}
        >
          <span className={styles.slashItemLabel}>
            {cmd.label} <span className={styles.slashItemDesc}>/{cmd.name}</span>
          </span>
          <span className={styles.slashItemDesc}>
            {cmd.description}
            {/* The quicker way, so knowing / is enough to find the rest (doc 26, P2). */}
            {cmd.faster && ` · or ${ways(helper(cmd.faster))[0]}`}
          </span>
          <kbd className={styles.slashItemKbd}>Tab</kbd>
        </button>
      ))}
    </div>
  );
}
