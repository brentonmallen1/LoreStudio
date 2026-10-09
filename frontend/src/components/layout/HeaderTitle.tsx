import { Link, useNavigate, useParams } from "react-router-dom";
import LogoMark from "../common/LogoMark";
import { useStoryStore } from "../../stores/storyStore";
import StoryCrumbs from "./StoryCrumbs";
import styles from "./GlobalHeader.module.css";

/**
 * The header's left side: the app name, or inside a story a way back to your stories and
 * the trail of where you are (doc 24 P5: series, book, page, section, entry; or while
 * writing, book, act, chapter, scene), which ends in the way back to the prose.
 */
export default function HeaderTitle() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const activeStory = useStoryStore((s) => s.activeStory);

  if (!storyId || activeStory?.id !== storyId) {
    return (
      <Link to="/" className={styles.wordmark}>
        <LogoMark size={20} />
        LoreStudio
      </Link>
    );
  }

  return (
    <div className={styles.storyTitleRow}>
      <button className={styles.backToStories} onClick={() => navigate("/")} title="All stories">
        <LogoMark size={20} />
        <span className={styles.srOnly}>All stories</span>
      </button>
      <StoryCrumbs storyId={storyId} />
    </div>
  );
}
