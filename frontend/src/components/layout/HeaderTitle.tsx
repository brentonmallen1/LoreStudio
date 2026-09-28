import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import styles from "./GlobalHeader.module.css";

/**
 * The header's left side: the app name, or inside a story a way back to your stories,
 * the story's title, and the sidebar's collapse control beside it (todo.md feedback).
 *
 * The collapse control used to sit at the bottom of the sidebar and the way back was an
 * unlabelled library icon beside a second copy of the title; both moved here.
 */
export default function HeaderTitle() {
  const { storyId } = useParams<{ storyId: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeStory = useStoryStore((s) => s.activeStory);
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();

  if (!storyId || activeStory?.id !== storyId) {
    return (
      <Link to="/" className={styles.wordmark}>
        LoreStudio
      </Link>
    );
  }

  // The Write page always shows the icon rail, so there is nothing to toggle there.
  const writing = pathname.endsWith("/write");
  return (
    <div className={styles.storyTitleRow}>
      <button className={styles.backToStories} onClick={() => navigate("/")} title="All stories">
        <ArrowLeft size={14} />
        <span className={styles.srOnly}>All stories</span>
      </button>
      <span className={styles.storyTitle} title={activeStory.title}>
        {activeStory.title}
      </span>
      {!writing && (
        <button
          className={styles.iconBtn}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      )}
    </div>
  );
}
