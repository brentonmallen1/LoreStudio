import { useEffect, useRef, useState } from "react";
import { useDiscoveryStore } from "../../stores/discoveryStore";
import { useHealthStore } from "../../stores/healthStore";
import { Link, useLocation, useParams } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { TOOL_ICONS } from "../panel/toolIcons";
import { useMode } from "../../lib/mode";
import { DOMAIN_LABELS, routesFor, storyPath, type Domain } from "../../lib/routes";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import { toolTabId, type ToolId } from "../../types/panel";
import styles from "./Strip.module.css";

const TOOLS: { tool: ToolId; label: string; icon: (typeof TOOL_ICONS)[ToolId] }[] = [
  { tool: "characters", label: "Characters", icon: TOOL_ICONS.characters },
  { tool: "places", label: "Places", icon: TOOL_ICONS.places },
  { tool: "threads", label: "Plot threads", icon: TOOL_ICONS.threads },
  { tool: "ideas", label: "Ideas", icon: TOOL_ICONS.ideas },
  { tool: "questions", label: "Open questions", icon: TOOL_ICONS.questions },
];

const DOMAIN_ORDER: Domain[] = ["manuscript", "lorebook", "compendium", "codex", "chronicle", "system"];

/** The tools at the foot of the strip: each opens as a tab beside the page; More lists every page. */
export default function ToolRail({ wide }: { wide: boolean }) {
  const { storyId } = useParams<{ storyId: string }>();
  const { pathname } = useLocation();
  const mode = useMode();
  const { tabs, activeTabId, openTool } = usePanelStore();
  const discoveryEnabled = useStoryStore((s) => s.activeStory?.discovery_enabled);
  const { pendingCount, refreshCount } = useDiscoveryStore();
  const { alertCount, refreshAlerts } = useHealthStore();
  const badges: Record<string, number | undefined> = {
    health: alertCount || undefined,
    discoveries: pendingCount || undefined,
  };
  useEffect(() => {
    if (storyId && discoveryEnabled) refreshCount(storyId);
  }, [storyId, discoveryEnabled]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (storyId) refreshAlerts(storyId);
  }, [storyId]); // eslint-disable-line react-hooks/exhaustive-deps
  const badgeTotal = Object.values(badges).reduce<number>((n, b) => n + (b ?? 0), 0);
  const [moreOpen, setMoreOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMoreOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const routes = routesFor(mode).filter(
    (r) => r.id !== "write" && r.id !== "overview" && (r.id !== "discoveries" || discoveryEnabled),
  );
  const openIds = new Set(tabs.map((t) => t.id));

  return (
    <>
      {TOOLS.map(({ tool, label, icon: Icon }) => {
        const id = toolTabId(tool);
        return (
          <button
            key={tool}
            className={`${styles.toolBtn} ${openIds.has(id) ? styles.toolBtnOpen : ""} ${activeTabId === id ? styles.toolBtnOn : ""}`}
            onClick={() => openTool(tool)}
            title={`${label}: open beside the page`}
            aria-label={label}
            aria-pressed={activeTabId === id}
          >
            <Icon size={16} />
          </button>
        );
      })}
      <div ref={ref} style={{ position: "relative" }}>
        <button
          className={styles.toolBtn}
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-label="More pages"
          title="More pages"
        >
          <MoreHorizontal size={16} />
          {badgeTotal > 0 && <span className={styles.badge}>{badgeTotal}</span>}
        </button>
        {moreOpen && (
          <div className={styles.menu} role="menu" aria-label="More pages" style={{ bottom: wide ? 0 : 8 }}>
            {DOMAIN_ORDER.map((domain) => {
              const rows = routes.filter((r) => r.domain === domain);
              if (!rows.length) return null;
              return (
                <div key={domain}>
                  <div className={styles.menuHeader}>{DOMAIN_LABELS[domain]}</div>
                  {rows.map((r) => {
                    const Icon = r.icon;
                    const on = pathname.startsWith(storyPath(storyId!, r)) && r.path !== "";
                    return (
                      <Link
                        key={r.id}
                        role="menuitem"
                        to={storyPath(storyId!, r)}
                        className={`${styles.menuItem} ${on ? styles.menuItemOn : ""}`}
                        style={{ minHeight: 34 }}
                        onClick={() => setMoreOpen(false)}
                      >
                        <Icon size={14} />
                        <span className={styles.menuLabel}>{r.label}</span>
                        {badges[r.id] && <span className={styles.badge}>{badges[r.id]}</span>}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
