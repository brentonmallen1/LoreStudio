import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { STRIP_PX, fitTabs, stripBudget, tabMinWidth } from "../../lib/panel/overflow";
import { pageTabLabel } from "../../lib/panel/pages";
import { tabLabel } from "../../lib/panel/tabLabel";
import { findRoute } from "../../lib/routes";
import { navigateMain } from "../../lib/panel/panelSync";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import { scaledPx } from "../../lib/appearance/uiScale";
import type { PanelTab } from "../../types/panel";
import OpenMenu from "./OpenMenu";
import OverflowMenu from "./OverflowMenu";
import styles from "./Panel.module.css";

/**
 * The tabs across the top of the panel: only what the author opened (doc 24 D11), people,
 * places and threads and pages beside the prose; This scene and the tools are on the rail.
 * Tabs shrink between a narrowest and a widest width, the name truncating, and what fits is
 * arithmetic at the narrowest (lib/panel/overflow.ts) rather than measurement; the rest fold
 * into ☰. No colour dots: the name is the tab. While a page is showing, "Full page ↗" at the
 * end goes to the real thing.
 */
export default function TabStrip() {
  const { tabs, showing, activate, close, setHighlight } = usePanelStore();
  const storyId = useStoryStore((s) => s.activeStory?.id);
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
  const page = tabs.find((t) => t.id === showing && t.kind === "page");
  const budget = stripBudget(tabs, showing, available, { fullPage: !!page, px });
  const { visible, hidden } = fitTabs(
    tabs,
    budget.widths,
    budget.room,
    showing,
    budget.overflowReserve,
    budget.defaultWidth,
  );
  const menuVisible = menuOpen && hidden.length > 0;

  function hoverTab(tab: PanelTab | null) {
    if (tab?.kind === "entity") setHighlight({ kind: tab.entityKind, id: tab.entityId, name: tab.label });
    else {
      // Leaving a tab falls back to the one showing, so the highlight follows selection.
      const { tabs: all, showing: id } = usePanelStore.getState();
      const active = all.find((t) => t.id === id);
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
        const selected = tab.id === showing;
        const min = tabMinWidth(selected, px);
        const Icon = tab.kind === "page" ? findRoute(tab.routeId)?.icon : undefined;
        const title = tab.kind === "page" ? pageTabLabel(tab.routeId, tab.path).title : tab.label;
        return (
          <div
            key={tab.id}
            className={`${styles.tab} ${selected ? styles.tabActive : ""}`}
            style={
              {
                "--tab-min": `${min}px`,
                "--tab-max": `${Math.max(min, px(STRIP_PX.tabMax))}px`,
              } as React.CSSProperties
            }
            onMouseEnter={() => hoverTab(tab)}
            onMouseLeave={() => hoverTab(null)}
          >
            <button
              aria-current={selected ? "true" : undefined}
              className={styles.tabLabel}
              title={title}
              onClick={() => activate(tab.id)}
            >
              {Icon && <Icon size={13} aria-hidden className={styles.tabIcon} />}
              <span>{tabLabel(tab)}</span>
            </button>
            {selected && (
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
      {page?.kind === "page" && storyId && (
        <button
          className={styles.fullPage}
          title={`Open ${tabLabel(page)} as the page`}
          onClick={() => navigateMain(`/stories/${storyId}${page.path}`)}
        >
          Full page <ArrowUpRight size={12} aria-hidden />
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
