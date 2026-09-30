import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import { api } from "../../../api/client";
import type { Story, StructureNode, Twist } from "../../../types";
import styles from "../SceneEditor.module.css";

export default function LinkedTwistsField({
  activeNode,
  activeStory,
}: {
  activeNode: StructureNode;
  activeStory: Story;
}) {
  const [twists, setTwists] = useState<Twist[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getTwistsForScene(activeNode.id)
      .then(setTwists)
      .catch(() => {});
  }, [activeNode.id]);

  if (twists.length === 0) return null;
  const go = () => navigate(`/stories/${activeStory.id}/lorebook/twists`);

  return (
    <div className={styles.overviewField}>
      <div className={styles.linkedHeader}>
        <label className={styles.overviewLabel}>
          <Eye size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: "0.25rem" }} />
          Linked Twists
        </label>
        <button className={styles.addLinkBtn} onClick={go} title="Manage twists">
          Manage
        </button>
      </div>
      <div className={styles.linkChips}>
        {twists.map((twist) => {
          const isReveal = twist.revealed_at_node_id === activeNode.id;
          const clues = twist.clues.filter((c) => c.node_id === activeNode.id).length;
          const clueText = `${clues} clue${clues !== 1 ? "s" : ""}`;
          return (
            <div key={twist.id} className={styles.linkChip}>
              <button
                className={styles.linkChipContent}
                onClick={go}
                title={isReveal ? "Reveal scene for this twist" : `${clueText} planted here`}
              >
                <span className={styles.linkChipLabel}>{isReveal ? "reveal" : clueText}</span>
                <span className={styles.linkChipTitle}>{twist.name}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
