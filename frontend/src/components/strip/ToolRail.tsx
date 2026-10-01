import { useEffect, useRef, useState } from "react";
import { useDiscoveryStore } from "../../stores/discoveryStore";
import { useOpenFindings } from "../../stores/findingsStore";
import { Link, useLocation, useParams } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { TOOL_ICONS } from "../panel/toolIcons";
import { useMode } from "../../lib/mode";
import { useAIAvailable } from "../../lib/mode";
import { routesFor, sectionModes, sectionPath, storyPath, type Domain } from "../../lib/routes";
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

/** Groups of the More menu, divided by a rule: home and plan, canon, research, AI, history, the rest. */
const DOMAIN_ORDER: Domain[][] = [
  ["home", "manuscript"],
  ["lorebook"],
  ["compendium"],
  ["codex"],
  ["chronicle"],
  ["system"],
];

/** The tools at the foot of the strip: each opens as a tab beside the page; More lists every page. */
export default function ToolRail({ wide }: { wide: boolean }) {
  const { storyId } = useParams<{ storyId: string }>();
  const { pathname } = useLocation();
  const mode = useMode();
  const aiAvailable = useAIAvailable();
  const { tabs, activeTabId, openTool } = usePanelStore();
  const discoveryEnabled = useStoryStore((s) => s.activeStory?.discovery_enabled);
  const { pendingCount, refreshCount } = useDiscoveryStore();
  const openFindings = useOpenFindings().length;
  const badges: Record<string, number | undefined> = {
    health: openFindings || undefined,
    discoveries: pendingCount || undefined,
  };
  useEffect(() => {
    if (storyId && discoveryEnabled) refreshCount(storyId);
  }, [storyId, discoveryEnabled]); // eslint-disable-line react-hooks/exhaustive-deps
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
    (r) => r.id !== "write" && (r.id !== "discoveries" || discoveryEnabled) && (!r.ai || aiAvailable),
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
          <div
            className={styles.menu}
            role="menu"
            aria-label="More pages"
            style={{ bottom: wide ? 0 : 8, maxHeight: "calc(100vh - 72px)", overflowY: "auto" }}
          >
            {DOMAIN_ORDER.map((domains, gi) => {
              const rows = routes.filter((r) => domains.includes(r.domain));
              if (!rows.length) return null;
              return (
                <div key={domains.join()} className={gi > 0 ? styles.menuGroup : undefined}>
                  {rows.map((r) => {
                    const Icon = r.icon;
                    const on = r.path !== "" && pathname.startsWith(storyPath(storyId!, r));
                    const sections = (r.sections ?? []).filter((sec) => {
                      const m = sectionModes(r, sec);
                      return m.modes.includes(mode) && (!m.ai || aiAvailable);
                    });
                    return (
                      <div key={r.id}>
                        <Link
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
                        {sections.length > 0 && (
                          <div className={styles.menuSections}>
                            {sections.map((sec) => {
                              const to = sectionPath(storyId!, r.id, sec.id);
                              return (
                                <Link
                                  key={sec.id}
                                  role="menuitem"
                                  to={to}
                                  className={`${styles.menuSection} ${(sec.path === "" ? pathname === to : pathname.startsWith(to)) ? styles.menuSectionOn : ""}`}
                                  onClick={() => setMoreOpen(false)}
                                >
                                  {sec.label}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
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
