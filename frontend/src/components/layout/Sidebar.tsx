import { useEffect } from "react";
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

  // Refresh discovery badge count when story changes
  useEffect(() => {
    if (storyId && activeStory?.discovery_enabled) refreshCount(storyId);
  }, [storyId, activeStory?.discovery_enabled]);

  // Refresh health alert badge when story changes
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

  const tabs: { id: string; icon: LucideIcon; label: string; path: string; badge?: number }[] = [
    { id: "overview",      icon: Home,              label: "Overview",         path: "" },
    { id: "story",         icon: PenLine,           label: "Write",            path: "/write" },
    { id: "outline",       icon: ListTree,          label: "Outline",          path: "/outline" },
    { id: "characters",    icon: Users,             label: "Characters",       path: "/characters" },
    { id: "lorebook",      icon: Scroll,            label: "Lorebook",         path: "/lorebook" },
    { id: "compendium",    icon: BookOpen,          label: "Compendium",       path: "/compendium" },
    { id: "panels",        icon: MessageSquareMore, label: "Group Interviews", path: "/panels" },
    { id: "threads",       icon: GitBranch,         label: "Plot Threads",     path: "/threads" },
    { id: "twists",        icon: Eye,               label: "Twists",           path: "/twists" },
    { id: "whatif",        icon: Shuffle,           label: "What If?",         path: "/whatif" },
    { id: "worldbuilding", icon: Globe,             label: "World Building",   path: "/worldbuilding" },
    { id: "media",         icon: Images,            label: "Media & Diagrams", path: "/media" },
    { id: "health",        icon: Activity,          label: "Story Health",     path: "/health", badge: alertCount || undefined },
    ...(activeStory?.discovery_enabled
      ? [{ id: "discoveries", icon: Telescope, label: "Discoveries", path: "/discoveries", badge: pendingCount || undefined }]
      : []),
    { id: "chronicle",     icon: Clock,             label: "Chronicle",        path: "/chronicle" },
    { id: "versions",      icon: History,           label: "Versions",         path: "/versions" },
    { id: "publish",       icon: Send,              label: "Publish",          path: "/publish" },
  ];

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
        {/* Expand button when collapsed in normal mode; dashboard icon in overlay mode */}
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

        {tabs.map(({ id, icon: Icon, label, path, badge }) => {
          const activityStatus = getTabStatus(id);
          const isWriteTab = id === "story";

          if (isWriteTab) {
            return (
              <div key={id} className={styles.writeTabRow}>
                <button
                  onClick={() => {
                    navigate(`/stories/${storyId}${path}`);
                    markViewed(id);
                  }}
                  className={`${styles.railBtn} ${styles.writeTabBtn} ${tab === id ? styles.railBtnActive : ""}`}
                  title={isCollapsed ? label : undefined}
                >
                  <Icon size={16} />
                  {!isCollapsed && <span className={styles.railLabel}>{label}</span>}
                  {badge ? (
                    <span style={{
                      marginLeft: "auto",
                      background: "var(--color-accent)",
                      color: "white",
                      borderRadius: "9px",
                      fontSize: "9px",
                      fontWeight: 700,
                      padding: "1px 5px",
                      minWidth: "16px",
                      textAlign: "center",
                      lineHeight: "14px",
                      flexShrink: 0,
                    }}>{badge}</span>
                  ) : (
                    <TabActivityIndicator status={activityStatus} />
                  )}
                </button>
                {!isCollapsed && (
                  <button
                    className={`${styles.treeToggleBtn} ${treeDetached ? styles.treeToggleBtnActive : ""}`}
                    onClick={() => setTreeDetached(!treeDetached)}
                    title={treeDetached ? "Close structure tree" : "Open structure tree"}
                  >
                    <PanelRightOpen size={13} />
                  </button>
                )}
              </div>
            );
          }

          return (
            <button
              key={id}
              onClick={() => {
                navigate(`/stories/${storyId}${path}`);
                markViewed(id);
              }}
              className={`${styles.railBtn} ${tab === id ? styles.railBtnActive : ""}`}
              title={isCollapsed ? (badge ? `${label} (${badge})` : label) : undefined}
            >
              <Icon size={16} />
              {!isCollapsed && <span className={styles.railLabel}>{label}</span>}
              {badge ? (
                <span style={{
                  marginLeft: "auto",
                  background: "var(--color-accent)",
                  color: "white",
                  borderRadius: "9px",
                  fontSize: "9px",
                  fontWeight: 700,
                  padding: "1px 5px",
                  minWidth: "16px",
                  textAlign: "center",
                  lineHeight: "14px",
                  flexShrink: 0,
                }}>{badge}</span>
              ) : (
                <TabActivityIndicator status={activityStatus} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Content panels — expanded only */}
      {!isCollapsed && (
        <>
          {/* Characters list */}
          {tab === "characters" && (
            <div className={styles.tree}>
              {characters.length === 0 && (
                <p className={styles.emptyHint}>No characters yet</p>
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
