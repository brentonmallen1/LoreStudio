import { lazy, Suspense } from "react";
import { useAIAvailable } from "../../lib/mode";
import { usePanelStore } from "../../stores/panelStore";
import EntityTab from "./EntityTab";
import PanelFrame from "./PanelFrame";
import TabStrip from "./TabStrip";
import ThisSceneTab from "./ThisSceneTab";
import ToolTab from "./ToolTab";
import styles from "./Panel.module.css";

// Loaded only when the Assistant tab is open: Writer mode never fetches the AI code.
const AssistantTabBody = lazy(() => import("../ai/AssistantTabBody"));

/**
 * The side panel (refactor doc 11): everything beside the page, as tabs, in a frame that
 * docks, floats or pops out to its own window. Mounted once by the story workspace, and
 * again, filling the page, by the pop-out window.
 */
export default function StoryPanel({ fill = false }: { fill?: boolean }) {
  const { open, tabs, activeTabId, frame } = usePanelStore();
  const aiAvailable = useAIAvailable();
  if (!open && !fill) return null;
  const showAssistant = activeTabId === "assistant" && aiAvailable;
  const active = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  return (
    <PanelFrame frame={fill ? "docked" : frame} fill={fill}>
      <TabStrip inWindow={fill} />
      <div className={styles.body}>
        {showAssistant ? (
          <Suspense fallback={<p className={`${styles.section} ${styles.empty}`}>Loading…</p>}>
            <div className={styles.aiBody}>
              <AssistantTabBody />
            </div>
          </Suspense>
        ) : active.kind === "scene" ? (
          <ThisSceneTab />
        ) : active.kind === "entity" ? (
          <EntityTab key={active.id} tab={active} />
        ) : (
          <ToolTab key={active.id} tab={active} />
        )}
      </div>
    </PanelFrame>
  );
}
