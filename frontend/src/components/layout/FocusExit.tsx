import { Minimize2 } from "lucide-react";
import { SHORTCUTS, formatCombo } from "../../lib/keyboard/shortcuts";
import { useUIStore } from "../../stores/uiStore";
import styles from "./GlobalLayout.module.css";

/**
 * The way out of focus mode, always on screen (doc 13 P2). The header hides in focus mode
 * and only comes back when the pointer reaches the top edge, which nobody finds; this sits
 * quietly in the corner until the pointer or the keyboard reaches it. On the prose it sits
 * in the status corner beside the save light (`inline`, doc 24), and not in the window's.
 */
export default function FocusExit({ inline = false }: { inline?: boolean }) {
  const setViewState = useUIStore((s) => s.setViewState);
  return (
    <button
      type="button"
      className={inline ? styles.focusExitInline : styles.focusExit}
      onClick={() => setViewState("normal")}
    >
      <Minimize2 size={13} aria-hidden />
      Leave focus
      <kbd className={styles.focusKey}>{formatCombo(SHORTCUTS.focusMode.combo)}</kbd>
    </button>
  );
}
