import { Minimize2 } from "lucide-react";
import { SHORTCUTS, formatCombo } from "../../lib/keyboard/shortcuts";
import { useUIStore } from "../../stores/uiStore";
import styles from "./GlobalLayout.module.css";

/**
 * The way out of focus mode, always on screen (doc 13 P2). The header hides in focus mode
 * and only comes back when the pointer reaches the top edge, which nobody finds; this sits
 * quietly in the corner until the pointer or the keyboard reaches it.
 */
export default function FocusExit() {
  const setViewState = useUIStore((s) => s.setViewState);
  return (
    <button type="button" className={styles.focusExit} onClick={() => setViewState("normal")}>
      <Minimize2 size={13} aria-hidden />
      Exit focus
      <kbd className={styles.focusKey}>{formatCombo(SHORTCUTS.focusMode.combo)}</kbd>
    </button>
  );
}
