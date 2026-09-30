import { nextWidth } from "../../lib/strip/stripModel";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronDown, SquareLibrary } from "lucide-react";
import { useDiscoveryStore } from "../../stores/discoveryStore";
import { useHealthStore } from "../../stores/healthStore";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import { useLLMStore } from "../../stores/llmStore";
import { useAIAvailable, useMode } from "../../lib/mode";
import { DOMAIN_LABELS, routesFor, storyPath, type Domain, type StoryRoute } from "../../lib/routes";
import { TabActivityIndicator } from "./TabActivityIndicator";
import AIActivityIndicator from "./AIActivityIndicator";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  collapsed?: boolean;
  onMouseLeave?: () => void;
  onMouseEnter?: () => void;
}

/** Order of the domain groups in the rail. Home has no header. */
const DOMAIN_ORDER: Domain[] = [
  "home",
  "manuscript",
  "lorebook",
  "compendium",
  "codex",
  "chronicle",
  "system",
];

/** Which route is active for the current URL (longest matching path wins). */
function activeRouteId(pathname: string, routes: StoryRoute[]): string {
  const rest = pathname.replace(/^\/stories\/[^/]+/, "");
  let best: StoryRoute | null = null;
  for (const r of routes) {
    if (r.path === "" ? rest === "" || rest === "/" || rest === "/overview" : rest.startsWith(r.path)) {
      if (!best || r.path.length > best.path.length) best = r;
    }
  }
  return best?.id ?? "overview";
}

/**
 * Story navigation rail. Reads lib/routes.ts (one list for sidebar + palette), groups by the
 * five CLAUDE.md domains, hides Studio-only pages in Writer mode, and keeps the collapse
 * control at the bottom of the rail where the todo.md feedback asked for it.
 *
 * On the Write page it is always the icon rail, whatever the collapse preference: the
 * structure tree is that page's panel, and a column of page links beside a column of
 * scenes was two sidebars. There the Write icon shows and hides the tree, as the active
 * icon of an activity bar does.
 */
export default function Sidebar({ collapsed: collapsedProp, onMouseLeave, onMouseEnter }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { storyId } = useParams<{ storyId: string }>();
  const { activeStory } = useStoryStore();
  const { sidebarCollapsed, stripWidth, setStripWidth } = useUIStore();
  const { pendingCount, refreshCount } = useDiscoveryStore();
  const { alertCount, refreshAlerts } = useHealthStore();
  const getTabStatus = useLLMStore((s) => s.getTabStatus);
  const markViewed = useLLMStore((s) => s.markViewed);
  const mode = useMode();
  const aiAvailable = useAIAvailable();

  const routes = routesFor(mode).filter((r) => r.id !== "discoveries" || activeStory?.discovery_enabled);
  const active = activeRouteId(location.pathname, routes);
  const writing = active === "write";
  const isCollapsed = collapsedProp ?? (writing || sidebarCollapsed);
  const badges: Record<string, number | undefined> = {
    health: alertCount || undefined,
    discoveries: pendingCount || undefined,
  };

  useEffect(() => {
    if (storyId && activeStory?.discovery_enabled) refreshCount(storyId);
  }, [storyId, activeStory?.discovery_enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (storyId) refreshAlerts(storyId);
  }, [storyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [closedGroups, setClosedGroups] = useState<Set<Domain>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("ls_sidebar_closed") ?? "[]"));
    } catch {
      return new Set();
    }
  });

  function toggleGroup(domain: Domain) {
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      try {
        localStorage.setItem("ls_sidebar_closed", JSON.stringify([...next]));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }

  function go(route: StoryRoute) {
    if (!storyId) return;
    navigate(storyPath(storyId, route));
    markViewed(route.id === "write" ? "story" : route.id);
  }

  function railTitle(r: StoryRoute, badge: number | undefined): string {
    if (r.id === "write" && writing) return "Write — widen or narrow the story strip";
    return badge ? `${r.label} (${badge})` : r.label;
  }

  function renderRoute(r: StoryRoute) {
    const Icon = r.icon;
    const isActive = active === r.id;
    const badge = badges[r.id];
    const status = getTabStatus(r.id === "write" ? "story" : r.id);
    return (
      <button
        key={r.id}
        onClick={() => (r.id === "write" && writing ? setStripWidth(nextWidth(stripWidth, true)) : go(r))}
        className={`${styles.railBtn} ${isActive ? styles.railBtnActive : ""}`}
        title={isCollapsed ? railTitle(r, badge) : undefined}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon size={16} />
        {!isCollapsed && <span className={styles.railLabel}>{r.label}</span>}
        {badge != null ? (
          <span className={styles.badge}>{badge}</span>
        ) : (
          <TabActivityIndicator status={status} />
        )}
      </button>
    );
  }

  const groups = DOMAIN_ORDER.map((d) => ({
    domain: d,
    routes: routes.filter((r) => r.domain === d),
  })).filter((g) => g.routes.length > 0);

  return (
    <aside
      className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ""} ${collapsedProp !== undefined ? styles.sidebarOverlay : ""}`}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
    >
      {/* The story's title, the way back and the collapse control are in the header
          (HeaderTitle.tsx), so they are in one place whatever the sidebar's state. */}
      <nav className={styles.tabRail} aria-label="Story sections">
        {isCollapsed && collapsedProp !== undefined && (
          <button onClick={() => navigate("/")} className={styles.railBtn} title="All stories">
            <SquareLibrary size={16} />
          </button>
        )}

        {isCollapsed
          ? routes.map(renderRoute)
          : groups.map((g) => {
              const label = DOMAIN_LABELS[g.domain];
              const isOpen = !closedGroups.has(g.domain) || g.routes.some((r) => r.id === active);
              const badgeTotal = g.routes.reduce((sum, r) => sum + (badges[r.id] ?? 0), 0);
              return (
                <div key={g.domain} className={styles.group}>
                  {label && (
                    <button
                      className={styles.groupHeader}
                      onClick={() => toggleGroup(g.domain)}
                      aria-expanded={isOpen}
                    >
                      <span className={styles.groupHeaderLabel}>{label}</span>
                      {!isOpen && badgeTotal > 0 && <span className={styles.groupBadge}>{badgeTotal}</span>}
                      <ChevronDown
                        size={11}
                        className={`${styles.groupChevron} ${!isOpen ? styles.groupChevronClosed : ""}`}
                      />
                    </button>
                  )}
                  {(isOpen || !label) && g.routes.map(renderRoute)}
                </div>
              );
            })}
      </nav>

      {!isCollapsed && aiAvailable && <AIActivityIndicator />}
    </aside>
  );
}
