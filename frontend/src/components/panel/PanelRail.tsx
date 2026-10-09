import {
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Feather,
  FileText,
  PanelRight,
  PictureInPicture2,
} from "lucide-react";
import { AI_WINDOW_PATH } from "../../lib/ai/panelChannel";
import { useAIAvailable } from "../../lib/mode";
import { SHORTCUTS, formatCombo } from "../../lib/keyboard/shortcuts";
import { tabLabel } from "../../lib/panel/tabLabel";
import { useAIStore } from "../../stores/aiStore";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import { TOOL_LABELS, toolTabId, type ToolId } from "../../types/panel";
import { TOOL_ICONS } from "./toolIcons";
import styles from "./Panel.module.css";

/** The tools the rail opens, in the order they sit down it. */
const TOOLS: ToolId[] = ["characters", "places", "threads", "notes", "freewrite"];

/**
 * The side panel's rail down the right edge, mirroring the story strip on the left and there
 * whether the panel is open or not: everything that opens beside the page starts here. This
 * scene and each tool, then, a little apart, the Assistant as the one filled button (doc 24:
 * its colour is its own, so it reads apart from the tools). What you opened (characters,
 * places, threads) is in the tab strip, not repeated here. Choosing the one already showing
 * folds the panel away.
 * While the panel is open its own controls sit at the top under the chevron (float or dock,
 * pop out), which leaves the tab strip to the tabs.
 */
export default function PanelRail() {
  const { tabs, activeTabId, open, activate, openTool, setOpen, frame, toggleFloating, setFrame } =
    usePanelStore();
  const aiAvailable = useAIAvailable();
  const sessionCount = useAIStore((s) => s.sessions.length);
  const storyId = useStoryStore((s) => s.activeStory?.id);
  // Re-render when the open node changes: the scene tab is named for its level.
  useStoryStore((s) => s.activeNode?.id);

  function popOut() {
    const story = storyId ? `?story=${encodeURIComponent(storyId)}` : "";
    // A named window means a second click focuses the one that is open, not a third panel.
    const opened = window.open(`${AI_WINDOW_PATH}${story}`, "lorestudio-panel", "width=520,height=800");
    if (opened) setFrame("window");
  }
  const openIds = new Set(tabs.map((t) => t.id));
  const shortcut = formatCombo(SHORTCUTS.togglePanel.combo);

  /** Show this tab, or fold the panel away if it is the one already showing. */
  function choose(id: string, show: () => void) {
    if (open && activeTabId === id) setOpen(false);
    else show();
  }
  const cls = (id: string, extra = "") =>
    [
      styles.railBtn,
      openIds.has(id) && id !== "scene" ? styles.railBtnOpen : "",
      open && activeTabId === id ? styles.railBtnOn : "",
      extra,
    ].join(" ");

  return (
    <aside className={styles.rail} aria-label="Side panel tools">
      <button
        className={styles.railBtn}
        onClick={() => setOpen(!open)}
        title={`${open ? "Collapse" : "Expand"} the side panel (${shortcut})`}
        aria-label={`${open ? "Collapse" : "Expand"} the side panel`}
        aria-expanded={open}
      >
        {open ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
      </button>
      {open && (
        <>
          <button
            className={styles.railBtn}
            onClick={toggleFloating}
            title={frame === "floating" ? "Dock to the side" : "Float over the page"}
            aria-label={frame === "floating" ? "Dock the side panel" : "Float the side panel"}
          >
            {frame === "floating" ? <PanelRight size={14} /> : <PictureInPicture2 size={14} />}
          </button>
          <button
            className={styles.railBtn}
            onClick={popOut}
            title="Open in its own window"
            aria-label="Open the side panel in its own window"
          >
            <ExternalLink size={14} />
          </button>
        </>
      )}
      <div className={styles.railTabs}>
        <button
          className={cls("scene")}
          onClick={() => choose("scene", () => activate("scene"))}
          title={tabLabel({ id: "scene", kind: "scene" })}
          aria-label={tabLabel({ id: "scene", kind: "scene" })}
          aria-pressed={open && activeTabId === "scene"}
        >
          <FileText size={15} />
        </button>
        {TOOLS.map((tool) => {
          const id = toolTabId(tool);
          const Icon = TOOL_ICONS[tool];
          return (
            <button
              key={tool}
              className={cls(id)}
              onClick={() => choose(id, () => openTool(tool))}
              title={`${TOOL_LABELS[tool]}: open beside the page`}
              aria-label={TOOL_LABELS[tool]}
              aria-pressed={open && activeTabId === id}
            >
              <Icon size={15} />
            </button>
          );
        })}
        {aiAvailable && <span className={styles.railRule} aria-hidden />}
        {aiAvailable && (
          <button
            className={cls("assistant", styles.railAi)}
            onClick={() => choose("assistant", () => activate("assistant"))}
            title="Assistant"
            aria-label={`Assistant, ${sessionCount} ${sessionCount === 1 ? "session" : "sessions"}`}
            aria-pressed={open && activeTabId === "assistant"}
          >
            <Feather size={15} />
            {sessionCount > 0 && <span className={styles.railCount}>{sessionCount}</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
