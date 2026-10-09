import { useEffect, useRef, useState } from "react";
import { ExternalLink, Menu, PanelRight, PictureInPicture2, X } from "lucide-react";
import { useAIAvailable } from "../../lib/mode";
import { AI_WINDOW_PATH } from "../../lib/ai/panelChannel";
import AssistantTab from "./AssistantTab";
import { fitTabs } from "../../lib/panel/overflow";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import { scaledPx } from "../../lib/appearance/uiScale";
import type { PanelTab } from "../../types/panel";
import { tabLabel } from "../../lib/panel/tabLabel";
import OpenMenu from "./OpenMenu";
import OverflowMenu from "./OverflowMenu";
import { tabColor } from "./entityColor";
import styles from "./Panel.module.css";

const TAB_WIDTH = 96;
const SCENE_TAB_WIDTH = 92;
const OVERFLOW_RESERVE = 58;
const CONTROLS_RESERVE = 56;
const ASSISTANT_RESERVE = 70;
const OPEN_RESERVE = 32;

/**
 * The tabs across the top of the panel (doc 11). Fixed-width tabs so what fits is
 * arithmetic (lib/panel/overflow.ts) rather than measurement; the rest fold into ☰.
 */
export default function TabStrip({ inWindow = false }: { inWindow?: boolean }) {
  const { tabs, activeTabId, activate, close, setHighlight, frame, toggleFloating, setFrame } =
    usePanelStore();
  const aiAvailable = useAIAvailable();
  const storyId = useStoryStore((s) => s.activeStory?.id);
  // Re-render when the open node changes: the first tab is named for its level.
  useStoryStore((s) => s.activeNode?.id);
  const stripRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(600);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setAvailable(entry.contentRect.width);
      setMenuOpen(false);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The tabs' text and controls are rem, so the arithmetic follows the interface size.
  const uiScale = useUIStore((s) => s.uiScale);
  const px = (n: number) => scaledPx(n, uiScale);
  const widths = Object.fromEntries(
    tabs.map((t) => [t.id, px(t.kind === "scene" ? SCENE_TAB_WIDTH : TAB_WIDTH)]),
  );
  const reserved =
    px(OPEN_RESERVE) + (aiAvailable ? px(ASSISTANT_RESERVE) : 0) + (inWindow ? 0 : px(CONTROLS_RESERVE));
  const { visible, hidden } = fitTabs(
    tabs,
    widths,
    available - 4 - reserved,
    activeTabId,
    px(OVERFLOW_RESERVE),
    px(TAB_WIDTH),
  );

  function popOut() {
    const story = storyId ? `?story=${encodeURIComponent(storyId)}` : "";
    // A named window means a second click focuses the one that is open, not a third panel.
    const opened = window.open(`${AI_WINDOW_PATH}${story}`, "lorestudio-panel", "width=520,height=800");
    if (opened) setFrame("window");
  }
  const menuVisible = menuOpen && hidden.length > 0;

  function hoverTab(tab: PanelTab | null) {
    if (tab?.kind === "entity") setHighlight({ kind: tab.entityKind, id: tab.entityId, name: tab.label });
    else {
      // Leaving a tab falls back to the selected one, so the highlight follows selection.
      const active = usePanelStore.getState().tabs.find((t) => t.id === usePanelStore.getState().activeTabId);
      setHighlight(
        active?.kind === "entity"
          ? { kind: active.entityKind, id: active.entityId, name: active.label }
          : null,
      );
    }
  }

  return (
    // A group of buttons, not an ARIA tablist: the strip also holds the panel's controls and
    // the overflow, which a tablist may not contain, and there is no tabpanel (doc 17).
    <div ref={stripRef} className={styles.strip} role="group" aria-label="Side panel tabs">
      {visible.map((tab) => {
        const selected = tab.id === activeTabId;
        const color = tabColor(tab);
        return (
          <div
            key={tab.id}
            className={`${styles.tab} ${selected ? styles.tabActive : ""} ${tab.kind === "scene" ? styles.tabPinned : ""}`}
            style={{ "--tab-width": `${widths[tab.id]}px`, "--tab-color": color } as React.CSSProperties}
            onMouseEnter={() => hoverTab(tab)}
            onMouseLeave={() => hoverTab(null)}
          >
            <button
              aria-current={selected ? "true" : undefined}
              className={styles.tabLabel}
              title={tabLabel(tab)}
              onClick={() => activate(tab.id)}
            >
              {tab.kind !== "scene" && (
                <span className={`${styles.tabDot} ${tab.kind === "tool" ? styles.tabDotSquare : ""}`} />
              )}
              <span>{tabLabel(tab)}</span>
            </button>
            {selected && tab.kind !== "scene" && (
              <button
                className={styles.tabClose}
                aria-label={`Close ${tabLabel(tab)}`}
                onClick={() => close(tab.id)}
              >
                <X size={12} />
              </button>
            )}
          </div>
        );
      })}
      <OpenMenu />
      <div className={styles.stripSpacer} />
      {!inWindow && (
        <div className={styles.controls}>
          <button
            className={styles.controlBtn}
            onClick={toggleFloating}
            title={frame === "floating" ? "Dock to the side" : "Float over the page"}
            aria-label={frame === "floating" ? "Dock the side panel" : "Float the side panel"}
          >
            {frame === "floating" ? <PanelRight size={13} /> : <PictureInPicture2 size={13} />}
          </button>
          <button
            className={styles.controlBtn}
            onClick={popOut}
            title="Open in its own window"
            aria-label="Open the side panel in its own window"
          >
            <ExternalLink size={13} />
          </button>
        </div>
      )}
      {hidden.length > 0 && (
        <button
          className={styles.overflowBtn}
          aria-expanded={menuOpen}
          aria-label={`All tabs (${hidden.length} more)`}
          title="All tabs"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Menu size={13} />
          {hidden.length}
        </button>
      )}
      <AssistantTab />
      {menuVisible && (
        <OverflowMenu
          hidden={hidden}
          onPick={(id) => {
            activate(id);
            setMenuOpen(false);
          }}
          onClose={close}
          onDismiss={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
