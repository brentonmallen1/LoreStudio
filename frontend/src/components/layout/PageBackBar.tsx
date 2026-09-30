import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { sceneToResume } from "../../lib/resumeScene";
import { useStoryStore } from "../../stores/storyStore";
import styles from "./PageBackBar.module.css";

/**
 * Above every page that is not the prose (refactor doc 11, phase 4): the way back to
 * the scene you were writing. A big tool takes the centre until you go back.
 */
export default function PageBackBar() {
  const { storyId } = useParams<{ storyId: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { activeNode, structure } = useStoryStore();
  if (!storyId || pathname.includes("/write")) return null;
  const target =
    activeNode && activeNode.story_id === storyId ? activeNode : sceneToResume(storyId, structure, null);
  if (!target) return null;
  return (
    <div className={styles.bar}>
      <button className={styles.back} onClick={() => navigate(`/stories/${storyId}/write/${target.id}`)}>
        <ArrowLeft size={13} />
        Back to {target.title}
      </button>
    </div>
  );
}
