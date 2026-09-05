import { SLASH_COMMANDS } from "../story/SlashCommandExtension";
import type { SlashState, TodoInputState } from "./useSlashCommands";
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

export function TodoInputPopup({ todo }: { todo: TodoInputState }) {
  if (!todo.open) return null;
  return (
    <div className={styles.todoInputPopup} style={clampPopup(todo.pos.bottom, todo.pos.left, 120, 300)}>
      <p className={styles.todoInputHint}>New TODO</p>
      <input
        className={styles.todoInputField}
        autoFocus
        value={todo.text}
        onChange={(e) => todo.setText(e.target.value)}
        placeholder="What needs doing?"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            todo.submit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            todo.cancel();
          }
        }}
      />
      <div className={styles.todoInputActions}>
        <button
          className={styles.todoInputSubmit}
          onMouseDown={(e) => {
            e.preventDefault();
            todo.submit();
          }}
          disabled={!todo.text.trim()}
        >
          Add TODO
        </button>
        <button
          className={styles.todoInputCancel}
          onMouseDown={(e) => {
            e.preventDefault();
            todo.cancel();
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
