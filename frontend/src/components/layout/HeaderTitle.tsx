import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import LogoMark from "../common/LogoMark";
import { originLabel } from "../../lib/overlay";
import { sceneToResume } from "../../lib/resumeScene";
import { useStoryStore } from "../../stores/storyStore";
import BreadcrumbNav from "./BreadcrumbNav";
import SeriesCrumb from "../series/SeriesCrumb";
import styles from "./GlobalHeader.module.css";

/**
 * The header's left side: the app name, or inside a story a way back to your stories,
 * the series it is a book of (series doc), the story's title, and while writing the
 * breadcrumb of where you are (doc 11); on any
 * other page, that page's name (doc 12: the app bar names the story and the page).
 */
export default function HeaderTitle() {
  const { storyId } = useParams<{ storyId: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeStory = useStoryStore((s) => s.activeStory);
  const activeNode = useStoryStore((s) => s.activeNode);
  const structure = useStoryStore((s) => s.structure);

  if (!storyId || activeStory?.id !== storyId) {
    return (
      <Link to="/" className={styles.wordmark}>
        <LogoMark size={20} />
        LoreStudio
      </Link>
    );
  }

  const writing = pathname.includes("/write");
  // Away from the prose, the way back to the scene you were writing (doc 11 P4; in the app
  // bar since doc 12 P2, so pages keep their full height).
  // The Overview's own hero says where to carry on (the last scene edited), so the header
  // does not offer a second, different answer there (doc 14 review).
  const overview = /^\/stories\/[^/]+\/?$/.test(pathname);
  const back =
    writing || overview
      ? null
      : activeNode && activeNode.story_id === storyId
        ? activeNode
        : sceneToResume(storyId, structure, null);
  return (
    <div className={styles.storyTitleRow}>
      <button className={styles.backToStories} onClick={() => navigate("/")} title="All stories">
        <LogoMark size={20} />
        <span className={styles.srOnly}>All stories</span>
      </button>
      <SeriesCrumb storyId={storyId} compact={pathname.includes("/write")} />
      <span className={styles.storyTitle} title={activeStory.title}>
        {activeStory.title}
      </span>
      {writing ? <BreadcrumbNav /> : <span className={styles.pageName}>{originLabel(pathname)}</span>}
      {back && (
        <button
          className={styles.backToScene}
          onClick={() => navigate(`/stories/${storyId}/write/${back.id}`)}
          title={`Back to ${back.title}`}
        >
          <ArrowLeft size={14} aria-hidden />
          <span className={styles.backToSceneLabel}>Back to {back.title}</span>
        </button>
      )}
    </div>
  );
}
