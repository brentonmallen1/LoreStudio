import { usePanelStore } from "../../stores/panelStore";
import { usePanelFrame } from "../ai/usePanelFrame";
import EntityTab from "./EntityTab";
import TabStrip from "./TabStrip";
import ThisSceneTab from "./ThisSceneTab";
import ToolTab from "./ToolTab";
import styles from "./Panel.module.css";

/**
 * The side panel (refactor doc 11): everything beside the page, as tabs. Mounted once by
 * the story workspace, in the row with the page, so it takes its space from the page
 * rather than floating over it.
 */
export default function StoryPanel() {
  const { open, tabs, activeTabId } = usePanelStore();
  const { width, startRailResize } = usePanelFrame(false, {
    widthKey: "ls_panel_width",
    rectKey: "ls_panel_rect",
    defaultWidth: 360,
  });
  if (!open) return null;
  const active = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  return (
    <aside className={styles.panel} style={{ width }} aria-label="Side panel">
      <div className={styles.resizeHandle} onMouseDown={startRailResize} title="Drag to resize" />
      <TabStrip />
      <div className={styles.body}>
        {active.kind === "scene" && <ThisSceneTab />}
        {active.kind === "entity" && <EntityTab key={active.id} tab={active} />}
        {active.kind === "tool" && <ToolTab key={active.id} tab={active} />}
      </div>
    </aside>
  );
}
