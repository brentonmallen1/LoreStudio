import { SLASH_COMMANDS } from "../story/SlashCommandExtension";
import type { SlashState } from "./useSlashCommands";
import { clampPopup } from "./segmentMeta";
import styles from "./SceneEditor.module.css";

export function SlashPicker({ slash }: { slash: SlashState }) {
  if (!slash.open) return null;
  const matching = SLASH_COMMANDS.filter((c) => c.name.startsWith(slash.query));
  if (!matching.length) return null;
  return (
    <div className={styles.slashDropdown} style={clampPopup(slash.pos.bottom, slash.pos.left, 160, 300)}>
      <p className={styles.slashDropdownHint}>Slash commands</p>
      {matching.map((cmd, idx) => (
        <button
          key={cmd.name}
          className={`${styles.slashItem} ${idx === slash.selIdx ? styles.slashItemSelected : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            if (slash.range) slash.execute(cmd.name, slash.range.from, slash.range.to);
          }}
        >
          <span className={styles.slashItemLabel}>{cmd.label}</span>
          <span className={styles.slashItemDesc}>{cmd.description}</span>
          <kbd className={styles.slashItemKbd}>Tab</kbd>
        </button>
      ))}
    </div>
  );
}
