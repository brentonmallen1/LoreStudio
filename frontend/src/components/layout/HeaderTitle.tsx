import { Link, useParams } from "react-router-dom";
import LogoMenu from "./LogoMenu";
import { useStoryStore } from "../../stores/storyStore";
import StoryCrumbs from "./StoryCrumbs";
import styles from "./GlobalHeader.module.css";

/**
 * The header's left side: the logo menu, then the app name, or inside a story the trail of
 * where you are (doc 24 P5: series, book, page, section, entry; or while writing, book, act,
 * chapter, scene), which ends in the way back to the prose.
 */
export default function HeaderTitle() {
  const { storyId } = useParams<{ storyId: string }>();
  const activeStory = useStoryStore((s) => s.activeStory);

  if (!storyId || activeStory?.id !== storyId) {
    return (
      <div className={styles.storyTitleRow}>
        <LogoMenu />
        <Link to="/" className={styles.wordmark}>
          LoreStudio
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.storyTitleRow}>
      <LogoMenu />
      <StoryCrumbs storyId={storyId} />
    </div>
  );
}
