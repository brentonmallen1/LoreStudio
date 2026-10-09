import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { useAIAvailable } from "../../lib/mode";
import AssistantTab from "./AssistantTab";
import { STRIP_PX, fitTabs, stripBudget, tabMinWidth } from "../../lib/panel/overflow";
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

/**
 * The tabs across the top of the panel (doc 11). Tabs shrink between a narrowest and a widest
 * width, the name truncating, and what fits is arithmetic at the narrowest
 * (lib/panel/overflow.ts) rather than measurement; the rest fold into ☰. Beside the page the
 * rail owns the panel (its controls and the Assistant); in the pop-out window, which has no
 * rail, the strip carries the Assistant tab.
 */
export default function TabStrip({ inWindow = false }: { inWindow?: boolean }) {
  const { tabs, activeTabId, activate, close, setHighlight } = usePanelStore();
  const aiAvailable = useAIAvailable();
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
  const showAssistant = inWindow && aiAvailable;
  const budget = stripBudget(tabs, activeTabId, available, { assistant: showAssistant, px });
  const { visible, hidden } = fitTabs(
    tabs,
    budget.widths,
    budget.room,
    activeTabId,
    budget.overflowReserve,
    budget.defaultWidth,
  );
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
    // A group of buttons, not an ARIA tablist: the strip also holds + Open… and the overflow,
    // which a tablist may not contain, and there is no tabpanel (doc 17).
    <div ref={stripRef} className={styles.strip} role="group" aria-label="Side panel tabs">
      {visible.map((tab) => {
        const selected = tab.id === activeTabId;
        const color = tabColor(tab);
        const min = tabMinWidth(tab, selected, px);
        return (
          <div
            key={tab.id}
            className={`${styles.tab} ${selected ? styles.tabActive : ""} ${tab.kind === "scene" ? styles.tabPinned : ""}`}
            style={
              {
                "--tab-min": `${min}px`,
                "--tab-max": `${Math.max(min, px(STRIP_PX.tabMax))}px`,
                "--tab-color": color,
              } as React.CSSProperties
            }
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
      {showAssistant && <AssistantTab />}
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
