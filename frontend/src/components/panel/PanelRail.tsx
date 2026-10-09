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
import { sceneTabLabel } from "../../lib/panel/tabLabel";
import { useAIStore } from "../../stores/aiStore";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import { TOOLS, TOOL_LABELS, launcherId, type Launcher } from "../../types/panel";
import { TOOL_ICONS } from "./toolIcons";
import styles from "./Panel.module.css";

/**
 * The side panel's rail down the right edge, mirroring the story strip on the left and there
 * whether the panel is open or not. The rail launches and the tabs hold (doc 24 D11): This
 * scene and each tool show in the panel from here without becoming tabs, then, a little
 * apart, the Assistant as the one filled button (its colour is its own, so it reads apart
 * from the tools). Choosing the one already showing folds the panel away.
 * While the panel is open its own controls sit at the top under the chevron (float or dock,
 * pop out), which leaves the tab strip to the tabs. In the pop-out window, which has no page
 * beside it, the rail is only the launchers.
 */
export default function PanelRail({ inWindow = false }: { inWindow?: boolean }) {
  const { showing, open, launch, setOpen, frame, toggleFloating, setFrame } = usePanelStore();
  const aiAvailable = useAIAvailable();
  const sessionCount = useAIStore((s) => s.sessions.length);
  const storyId = useStoryStore((s) => s.activeStory?.id);
  // Re-render when the open node changes: This scene is named for its level.
  useStoryStore((s) => s.activeNode?.id);
  const shown = (l: Launcher) => (open || inWindow) && showing === launcherId(l);

  function popOut() {
    const story = storyId ? `?story=${encodeURIComponent(storyId)}` : "";
    // A named window means a second click focuses the one that is open, not a third panel.
    const opened = window.open(`${AI_WINDOW_PATH}${story}`, "lorestudio-panel", "width=520,height=800");
    if (opened) setFrame("window");
  }
  const shortcut = formatCombo(SHORTCUTS.togglePanel.combo);

  /** Show it, or fold the panel away if it is the one already showing. */
  function choose(l: Launcher) {
    if (shown(l) && !inWindow) setOpen(false);
    else launch(l);
  }
  const cls = (l: Launcher, extra = "") =>
    [styles.railBtn, shown(l) ? styles.railBtnOn : "", extra].join(" ");
  const sceneLabel = sceneTabLabel();

  return (
    <aside className={`${styles.rail} ${inWindow ? styles.railInWindow : ""}`} aria-label="Side panel tools">
      {!inWindow && (
        <button
          className={styles.railBtn}
          onClick={() => setOpen(!open)}
          title={`${open ? "Collapse" : "Expand"} the side panel (${shortcut})`}
          aria-label={`${open ? "Collapse" : "Expand"} the side panel`}
          aria-expanded={open}
        >
          {open ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </button>
      )}
      {open && !inWindow && (
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
          onClick={() => choose("scene")}
          title={sceneLabel}
          aria-label={sceneLabel}
          aria-pressed={shown("scene")}
        >
          <FileText size={15} />
        </button>
        {TOOLS.map((tool) => {
          const Icon = TOOL_ICONS[tool];
          return (
            <button
              key={tool}
              className={cls(tool)}
              onClick={() => choose(tool)}
              title={`${TOOL_LABELS[tool]}: beside the page`}
              aria-label={TOOL_LABELS[tool]}
              aria-pressed={shown(tool)}
            >
              <Icon size={15} />
            </button>
          );
        })}
        {aiAvailable && <span className={styles.railRule} aria-hidden />}
        {aiAvailable && (
          <button
            className={cls("assistant", styles.railAi)}
            onClick={() => choose("assistant")}
            title="Assistant"
            aria-label={`Assistant, ${sessionCount} ${sessionCount === 1 ? "session" : "sessions"}`}
            aria-pressed={shown("assistant")}
          >
            <Feather size={15} />
            {sessionCount > 0 && <span className={styles.railCount}>{sessionCount}</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
