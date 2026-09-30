import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { fitTabs } from "../../lib/panel/overflow";
import { usePanelStore } from "../../stores/panelStore";
import type { PanelTab } from "../../types/panel";
import { tabLabel } from "../../lib/panel/tabLabel";
import OverflowMenu from "./OverflowMenu";
import { tabColor } from "./entityColor";
import styles from "./Panel.module.css";

const TAB_WIDTH = 96;
const SCENE_TAB_WIDTH = 92;
const OVERFLOW_RESERVE = 58;

/**
 * The tabs across the top of the panel (doc 11). Fixed-width tabs so what fits is
 * arithmetic (lib/panel/overflow.ts) rather than measurement; the rest fold into ☰.
 */
export default function TabStrip() {
  const { tabs, activeTabId, activate, close, setHighlight } = usePanelStore();
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

  const widths = Object.fromEntries(
    tabs.map((t) => [t.id, t.kind === "scene" ? SCENE_TAB_WIDTH : TAB_WIDTH]),
  );
  const { visible, hidden } = fitTabs(tabs, widths, available - 4, activeTabId, OVERFLOW_RESERVE, TAB_WIDTH);
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
    <div ref={stripRef} className={styles.strip} role="tablist" aria-label="Side panel">
      {visible.map((tab) => {
        const selected = tab.id === activeTabId;
        const color = tabColor(tab);
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={selected}
            className={`${styles.tab} ${selected ? styles.tabActive : ""} ${tab.kind === "scene" ? styles.tabPinned : ""}`}
            style={{ "--tab-width": `${widths[tab.id]}px`, "--tab-color": color } as React.CSSProperties}
            onMouseEnter={() => hoverTab(tab)}
            onMouseLeave={() => hoverTab(null)}
          >
            <button className={styles.tabLabel} title={tabLabel(tab)} onClick={() => activate(tab.id)}>
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
