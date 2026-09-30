import { ChevronsLeft, Feather, FileText } from "lucide-react";
import { useAIAvailable } from "../../lib/mode";
import { SHORTCUTS, formatCombo } from "../../lib/keyboard/shortcuts";
import { tabLabel } from "../../lib/panel/tabLabel";
import { useAIStore } from "../../stores/aiStore";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import { TOOL_ICONS } from "./toolIcons";
import { tabColor } from "./entityColor";
import styles from "./Panel.module.css";

/**
 * The side panel, collapsed (doc 11 P7): a slim rail down the right edge that mirrors the
 * story strip on the left. Each open tab is an icon — the scene, a coloured dot for a
 * character, place or thread, the tool's own icon, the Feather with its session count —
 * and any of them brings the panel back on that tab. The chevron at the top brings it back
 * as it was.
 */
export default function CollapsedRail() {
  const { tabs, activeTabId, activate, setOpen } = usePanelStore();
  const aiAvailable = useAIAvailable();
  const sessionCount = useAIStore((s) => s.sessions.length);
  // Re-render when the open node changes: the first tab is named for its level.
  useStoryStore((s) => s.activeNode?.id);

  return (
    <aside className={styles.rail} aria-label="Side panel (collapsed)">
      <button
        className={styles.railBtn}
        onClick={() => setOpen(true)}
        title={`Expand the side panel (${formatCombo(SHORTCUTS.togglePanel.combo)})`}
        aria-label="Expand the side panel"
      >
        <ChevronsLeft size={14} />
      </button>
      <div className={styles.railTabs}>
        {tabs.map((tab) => {
          const Icon = tab.kind === "tool" ? TOOL_ICONS[tab.tool] : tab.kind === "scene" ? FileText : null;
          return (
            <button
              key={tab.id}
              className={`${styles.railBtn} ${tab.id === activeTabId ? styles.railBtnOn : ""}`}
              onClick={() => activate(tab.id)}
              title={tabLabel(tab)}
              aria-label={tabLabel(tab)}
            >
              {Icon ? (
                <Icon size={14} />
              ) : (
                <span className={styles.railDot} style={{ background: tabColor(tab) }} />
              )}
            </button>
          );
        })}
      </div>
      {aiAvailable && (
        <button
          className={`${styles.railBtn} ${styles.railAi} ${activeTabId === "assistant" ? styles.railBtnOn : ""}`}
          onClick={() => activate("assistant")}
          title="Assistant"
          aria-label={`Assistant, ${sessionCount} ${sessionCount === 1 ? "session" : "sessions"}`}
        >
          <Feather size={14} />
          {sessionCount > 0 && <span className={styles.railCount}>{sessionCount}</span>}
        </button>
      )}
    </aside>
  );
}
