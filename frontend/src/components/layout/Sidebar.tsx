import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  Users,
  SquareLibrary,
  Scroll,
  MessageSquareMore,
  GitBranch,
  Clock,
  UserCircle2,
  Images,
  Activity,
  Home,
  PenLine,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  BookOpen,
  Globe,
  Telescope,
  Send,
  Eye,
  ListTree,
  History,
  Shuffle,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { useDiscoveryStore } from "../../stores/discoveryStore";
import { useHealthStore } from "../../stores/healthStore";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import { useLLMStore } from "../../stores/llmStore";
import { TabActivityIndicator } from "./TabActivityIndicator";
import AIActivityIndicator from "./AIActivityIndicator";
import styles from "./Sidebar.module.css";

type TabDef = { id: string; icon: LucideIcon; label: string; path: string; badge?: number };
type TabGroup = { id: string; label?: string; tabs: TabDef[] };

// Static map of tab → group for auto-expand logic
const TAB_GROUP: Record<string, string> = {
  overview: "core", story: "core", outline: "core", characters: "core",
  lorebook: "world", compendium: "world", worldbuilding: "world",
  threads: "tools", twists: "tools", whatif: "tools", panels: "tools", media: "tools",
  health: "system", discoveries: "system", chronicle: "system", versions: "system", publish: "system",
};

interface SidebarProps {
  collapsed?: boolean;
  onMouseLeave?: () => void;
  onMouseEnter?: () => void;
}

export default function Sidebar({ collapsed: collapsedProp, onMouseLeave, onMouseEnter }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { storyId, characterId } = useParams<{ storyId: string; characterId?: string }>();
  const { activeStory, characters } = useStoryStore();
  const {
    sidebarCollapsed, setSidebarCollapsed,
    treeDetached, setTreeDetached,
  } = useUIStore();
  const { pendingCount, refreshCount } = useDiscoveryStore();
  const { alertCount, refreshAlerts } = useHealthStore();
  const getTabStatus = useLLMStore((s) => s.getTabStatus);
  const markViewed = useLLMStore((s) => s.markViewed);

  const isCollapsed = collapsedProp ?? sidebarCollapsed;

  useEffect(() => {
    if (storyId && activeStory?.discovery_enabled) refreshCount(storyId);
  }, [storyId, activeStory?.discovery_enabled]);

  useEffect(() => {
    if (storyId) refreshAlerts(storyId);
  }, [storyId]);

  const tab = (() => {
    const path = location.pathname;
    if (path.includes("/characters")) return "characters";
    if (path.includes("/lorebook")) return "lorebook";
    if (path.includes("/compendium")) return "compendium";
    if (path.includes("/panels")) return "panels";
    if (path.includes("/threads")) return "threads";
    if (path.includes("/twists")) return "twists";
    if (path.includes("/whatif")) return "whatif";
    if (path.includes("/media")) return "media";
    if (path.includes("/health")) return "health";
    if (path.includes("/chronicle")) return "chronicle";
    if (path.includes("/versions")) return "versions";
    if (path.includes("/publish")) return "publish";
    if (path.includes("/worldbuilding")) return "worldbuilding";
    if (path.includes("/discoveries")) return "discoveries";
    if (path.includes("/outline")) return "outline";
    if (path.includes("/write")) return "story";
    return "overview";
  })();

  const tabGroups: TabGroup[] = [
    {
      id: "core",
      tabs: [
        { id: "overview",   icon: Home,    label: "Overview",   path: "" },
        { id: "story",      icon: PenLine, label: "Write",      path: "/write" },
        { id: "outline",    icon: ListTree, label: "Outline",   path: "/outline" },
        { id: "characters", icon: Users,   label: "Characters", path: "/characters" },
      ],
    },
    {
      id: "world",
      label: "World",
      tabs: [
        { id: "lorebook",      icon: Scroll,   label: "Lorebook",       path: "/lorebook" },
        { id: "compendium",    icon: BookOpen, label: "Compendium",     path: "/compendium" },
        { id: "worldbuilding", icon: Globe,    label: "World Building", path: "/worldbuilding" },
      ],
    },
    {
      id: "tools",
      label: "Tools",
      tabs: [
        { id: "threads", icon: GitBranch,         label: "Plot Threads",     path: "/threads" },
        { id: "twists",  icon: Eye,               label: "Twists",           path: "/twists" },
        { id: "whatif",  icon: Shuffle,           label: "What If?",         path: "/whatif" },
        { id: "panels",  icon: MessageSquareMore, label: "Group Interviews", path: "/panels" },
        { id: "media",   icon: Images,            label: "Media & Diagrams", path: "/media" },
      ],
    },
    {
      id: "system",
      label: "System",
      tabs: [
        { id: "health",   icon: Activity, label: "Story Health", path: "/health",     badge: alertCount || undefined },
        ...(activeStory?.discovery_enabled
          ? [{ id: "discoveries", icon: Telescope, label: "Discoveries", path: "/discoveries", badge: pendingCount || undefined }]
          : []),
        { id: "chronicle", icon: Clock,    label: "Chronicle", path: "/chronicle" },
        { id: "versions",  icon: History,  label: "Versions",  path: "/versions" },
        { id: "publish",   icon: Send,     label: "Publish",   path: "/publish" },
      ],
    },
  ];

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const activeGroup = TAB_GROUP[tab] ?? "core";
    return new Set(["core", activeGroup]);
  });

  // Auto-expand the group containing the active tab
  useEffect(() => {
    const activeGroup = TAB_GROUP[tab];
    if (activeGroup) {
      setOpenGroups(prev => {
        if (prev.has(activeGroup)) return prev;
        return new Set([...prev, activeGroup]);
      });
    }
  }, [tab]);

  function toggleGroup(groupId: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  function renderTabButton(t: TabDef) {
    const activityStatus = getTabStatus(t.id);
    const isActive = tab === t.id;
    const Icon = t.icon;

    // Write tab gets the tree panel toggle in expanded mode
    if (t.id === "story" && !isCollapsed) {
      return (
        <div key={t.id} className={styles.writeTabRow}>
          <button
            onClick={() => { navigate(`/stories/${storyId}${t.path}`); markViewed(t.id); }}
            className={`${styles.railBtn} ${styles.writeTabBtn} ${isActive ? styles.railBtnActive : ""}`}
          >
            <Icon size={16} />
            <span className={styles.railLabel}>{t.label}</span>
            {t.badge != null ? (
              <span className={styles.badge}>{t.badge}</span>
            ) : (
              <TabActivityIndicator status={activityStatus} />
            )}
          </button>
          <button
            className={`${styles.treeToggleBtn} ${treeDetached ? styles.treeToggleBtnActive : ""}`}
            onClick={() => setTreeDetached(!treeDetached)}
            title={treeDetached ? "Close structure tree" : "Open structure tree"}
          >
            <PanelRightOpen size={13} />
          </button>
        </div>
      );
    }

    return (
      <button
        key={t.id}
        onClick={() => { navigate(`/stories/${storyId}${t.path}`); markViewed(t.id); }}
        className={`${styles.railBtn} ${isActive ? styles.railBtnActive : ""}`}
        title={isCollapsed ? (t.badge ? `${t.label} (${t.badge})` : t.label) : undefined}
      >
        <Icon size={16} />
        {!isCollapsed && <span className={styles.railLabel}>{t.label}</span>}
        {t.badge != null ? (
          <span className={styles.badge}>{t.badge}</span>
        ) : (
          <TabActivityIndicator status={activityStatus} />
        )}
      </button>
    );
  }

  const allTabs = tabGroups.flatMap(g => g.tabs);

  return (
    <aside
      className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ""} ${collapsedProp !== undefined ? styles.sidebarOverlay : ""}`}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
    >
      {/* Header — expanded only */}
      {!isCollapsed && (
        <div className={styles.header}>
          <button
            onClick={() => navigate("/")}
            className={styles.backBtn}
            title="Back to dashboard"
          >
            <SquareLibrary size={14} />
          </button>
          <span className={styles.storyTitle} title={activeStory?.title}>
            {activeStory?.title ?? "Story"}
          </span>
          {collapsedProp === undefined && (
            <button
              className={styles.collapseToggle}
              onClick={() => setSidebarCollapsed(true)}
              title="Collapse sidebar"
            >
              <PanelLeftClose size={15} />
            </button>
          )}
        </div>
      )}

      {/* Vertical tab rail */}
      <nav className={styles.tabRail}>
        {/* Expand button when collapsed */}
        {isCollapsed && (
          collapsedProp === undefined
            ? (
              <button
                className={styles.railBtn}
                onClick={() => setSidebarCollapsed(false)}
                title="Expand sidebar"
              >
                <PanelLeftOpen size={15} />
              </button>
            )
            : (
              <button
                onClick={() => navigate("/")}
                className={styles.railBtn}
                title="Back to dashboard"
              >
                <SquareLibrary size={16} />
              </button>
            )
        )}

        {/* Collapsed: flat icon list. Expanded: grouped with collapsible sections. */}
        {isCollapsed ? (
          allTabs.map(t => renderTabButton(t))
        ) : (
          tabGroups.map(group => {
            const isOpen = openGroups.has(group.id);
            const groupBadgeTotal = group.tabs.reduce((sum, t) => sum + (t.badge ?? 0), 0);

            return (
              <div key={group.id} className={styles.group}>
                {group.label && (
                  <button
                    className={styles.groupHeader}
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isOpen}
                  >
                    <span className={styles.groupHeaderLabel}>{group.label}</span>
                    {!isOpen && groupBadgeTotal > 0 && (
                      <span className={styles.groupBadge}>{groupBadgeTotal}</span>
                    )}
                    <ChevronDown
                      size={11}
                      className={`${styles.groupChevron} ${!isOpen ? styles.groupChevronClosed : ""}`}
                    />
                  </button>
                )}
                {(isOpen || !group.label) && group.tabs.map(t => renderTabButton(t))}
              </div>
            );
          })
        )}
      </nav>

      {/* Content panels — expanded only */}
      {!isCollapsed && (
        <>
          {tab === "characters" && (
            <div className={styles.tree}>
              {characters.length === 0 && (
                <p className={styles.emptyHint}>Your cast will appear here.</p>
              )}
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => navigate(`/stories/${storyId}/characters/${char.id}`)}
                  className={`${styles.nodeRow} ${characterId === char.id ? styles.nodeActive : ""}`}
                >
                  <span className={styles.charAvatar}>{char.name[0].toUpperCase()}</span>
                  <span className={styles.nodeLabel}>{char.name}</span>
                  <span className={styles.roleBadge}>{char.role}</span>
                </button>
              ))}
            </div>
          )}

          {tab === "characters" && (
            <div className={styles.addSection}>
              <button
                onClick={() => navigate(`/stories/${storyId}/characters`)}
                className={styles.addBtn}
              >
                <UserCircle2 size={12} />
                All characters
              </button>
            </div>
          )}

          <AIActivityIndicator />
        </>
      )}
    </aside>
  );
}
