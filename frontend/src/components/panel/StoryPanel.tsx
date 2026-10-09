import { lazy, Suspense } from "react";
import { useAIAvailable } from "../../lib/mode";
import { usePanelStore } from "../../stores/panelStore";
import { launcherOf } from "../../types/panel";
import EntityTab from "./EntityTab";
import PanelFrame from "./PanelFrame";
import PanelRail from "./PanelRail";
import TabStrip from "./TabStrip";
import ThisSceneTab from "./ThisSceneTab";
import ToolTab from "./ToolTab";
import styles from "./Panel.module.css";

// Loaded only when the Assistant is showing: Writer mode never fetches the AI code.
const AssistantTabBody = lazy(() => import("../ai/AssistantTabBody"));
// A page beside the prose brings the story's routes with it: loaded when one is open.
const PageTab = lazy(() => import("./PageTab"));

const loading = <p className={`${styles.section} ${styles.empty}`}>Loading…</p>;

/**
 * The side panel (refactor doc 11): everything beside the page, in a frame that docks, floats
 * or pops out to its own window. It shows one thing: what the rail launched (This scene, a
 * tool, the Assistant) or a tab the author opened (doc 24 D11). Mounted once by the story
 * workspace, and again, filling the page, by the pop-out window, where the rail comes inside.
 */
export default function StoryPanel({ fill = false }: { fill?: boolean }) {
  const { open, tabs, showing, frame } = usePanelStore();
  const aiAvailable = useAIAvailable();
  // The rail down the right edge is always there beside the page, open or not; popped out to
  // its own window, the panel leaves only the strip saying where it went.
  const rail = !fill && frame !== "window" ? <PanelRail /> : null;
  if (!open && !fill) return rail;
  const launcher = launcherOf(showing);
  const tab = launcher ? undefined : tabs.find((t) => t.id === showing);

  let body: React.ReactNode;
  if (launcher === "assistant" && aiAvailable) {
    body = (
      <Suspense fallback={loading}>
        <div className={styles.aiBody}>
          <AssistantTabBody />
        </div>
      </Suspense>
    );
  } else if (launcher && launcher !== "scene" && launcher !== "assistant") {
    body = <ToolTab key={launcher} tool={launcher} />;
  } else if (tab?.kind === "entity") {
    body = <EntityTab key={tab.id} tab={tab} />;
  } else if (tab?.kind === "page") {
    body = (
      <Suspense fallback={loading}>
        <PageTab key={tab.id} tab={tab} />
      </Suspense>
    );
  } else {
    body = <ThisSceneTab />;
  }

  return (
    <>
      <PanelFrame frame={fill ? "docked" : frame} fill={fill}>
        <TabStrip />
        <div className={styles.body}>{body}</div>
      </PanelFrame>
      {fill && <PanelRail inWindow />}
      {rail}
    </>
  );
}
