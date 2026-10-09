import { Feather } from "lucide-react";
import { useAIAvailable } from "../../lib/mode";
import { useAIStore } from "../../stores/aiStore";
import { usePanelStore } from "../../stores/panelStore";
import styles from "./Panel.module.css";

/**
 * The assistant's tab (refactor doc 11, phase 5, "A2"): docked past a divider at the end
 * of the strip, icon-only with a session count, tinted with the AI colour, never folded
 * into the ☰ menu. The one icon-only AI control in the app: it is the panel's own tab,
 * not an action button, and it carries its name for assistive tech and the tooltip.
 * Drawn only in the pop-out window: beside the page the rail's Feather is the Assistant.
 */
export default function AssistantTab() {
  const aiAvailable = useAIAvailable();
  const count = useAIStore((s) => s.sessions.length);
  const selected = usePanelStore((s) => s.activeTabId === "assistant");
  const activate = usePanelStore((s) => s.activate);
  if (!aiAvailable) return null;
  const label = `Assistant, ${count} ${count === 1 ? "session" : "sessions"}`;
  return (
    <>
      <span className={styles.aiDivider} aria-hidden="true" />
      <div className={`${styles.tab} ${styles.aiTab} ${selected ? styles.aiTabOn : ""}`}>
        <button
          aria-current={selected ? "true" : undefined}
          className={styles.aiTabBtn}
          aria-label={label}
          title={label}
          onClick={() => activate("assistant")}
        >
          <Feather size={14} />
          {count > 0 && (
            <span className={`${styles.aiBadge} ${selected ? styles.aiBadgeOn : ""}`}>{count}</span>
          )}
        </button>
      </div>
    </>
  );
}
