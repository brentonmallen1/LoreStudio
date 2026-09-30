import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useStoryStore } from "../../stores/storyStore";
import BreadcrumbNav from "./BreadcrumbNav";
import styles from "./GlobalHeader.module.css";

/**
 * The header's left side: the app name, or inside a story a way back to your stories,
 * the story's title, and while writing the breadcrumb of where you are (doc 11).
 */
export default function HeaderTitle() {
  const { storyId } = useParams<{ storyId: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeStory = useStoryStore((s) => s.activeStory);

  if (!storyId || activeStory?.id !== storyId) {
    return (
      <Link to="/" className={styles.wordmark}>
        LoreStudio
      </Link>
    );
  }

  const writing = pathname.includes("/write");
  return (
    <div className={styles.storyTitleRow}>
      <button className={styles.backToStories} onClick={() => navigate("/")} title="All stories">
        <ArrowLeft size={14} />
        <span className={styles.srOnly}>All stories</span>
      </button>
      <span className={styles.storyTitle} title={activeStory.title}>
        {activeStory.title}
      </span>
      {writing && <BreadcrumbNav />}
    </div>
  );
}
