import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessageSquare, ChevronRight, AlertCircle } from "lucide-react";
import { api } from "../../api/client";
import type { DialogueBlockWithScene } from "../../types";
import styles from "./CharacterDialogueTab.module.css";

interface Props {
  characterId: string;
  characterName: string;
}

export default function CharacterDialogueTab({ characterId, characterName }: Props) {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<DialogueBlockWithScene[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getCharacterDialogue(characterId)
      .then(setBlocks)
      .catch(() => setBlocks([]))
      .finally(() => setLoading(false));
  }, [characterId]);

  if (loading) {
    return <div className={styles.empty}>Loading dialogue…</div>;
  }

  if (blocks.length === 0) {
    return (
      <div className={styles.empty}>
        <MessageSquare size={24} className={styles.emptyIcon} />
        <p>No attributed dialogue found for {characterName}.</p>
        <p className={styles.emptyHint}>
          Add explicit attribution using <code>"text"&lt;{characterName}&gt;</code> or use the
          Auto-tag feature in a scene to assign unattributed quotes.
        </p>
      </div>
    );
  }

  // Group by scene
  const sceneMap = new Map<string, { title: string; blocks: DialogueBlockWithScene[] }>();
  for (const block of blocks) {
    if (!sceneMap.has(block.scene_id)) {
      sceneMap.set(block.scene_id, { title: block.scene_title, blocks: [] });
    }
    sceneMap.get(block.scene_id)!.blocks.push(block);
  }

  const totalWords = blocks.reduce((sum, b) => sum + b.content.split(/\s+/).length, 0);
  const inferredCount = blocks.filter(
    (b) => b.attribution_method === "inferred" || b.attribution_method === "alternating"
  ).length;

  return (
    <div className={styles.root}>
      <div className={styles.summary}>
        <span>{blocks.length} lines</span>
        <span>{totalWords.toLocaleString()} words</span>
        {inferredCount > 0 && (
          <span className={styles.inferredNote}>
            <AlertCircle size={11} />
            {inferredCount} inferred
          </span>
        )}
      </div>

      {Array.from(sceneMap.entries()).map(([sceneId, { title, blocks: sceneBlocks }]) => (
        <div key={sceneId} className={styles.sceneGroup}>
          <button
            className={styles.sceneHeader}
            onClick={() => storyId && navigate(`/stories/${storyId}/scenes/${sceneId}`)}
            title="Go to scene"
          >
            <span className={styles.sceneTitle}>{title}</span>
            <span className={styles.sceneCount}>{sceneBlocks.length}×</span>
            <ChevronRight size={12} className={styles.sceneArrow} />
          </button>
          <div className={styles.lines}>
            {sceneBlocks.map((block) => {
              const isInferred = block.attribution_method === "inferred" || block.attribution_method === "alternating";
              const isThought = block.dialogue_type === "thought";
              return (
                <div
                  key={block.id}
                  className={`${styles.line} ${isInferred ? styles.lineInferred : ""} ${isThought ? styles.lineThought : ""}`}
                >
                  {isThought ? (
                    <span className={styles.lineContent}><em>{block.content}</em></span>
                  ) : (
                    <span className={styles.lineContent}>"{block.content}"</span>
                  )}
                  {isThought && <span className={styles.thoughtBadge} title="Inner monologue">thought</span>}
                  {!isThought && isInferred && (
                    <span className={styles.inferredBadge} title="Inferred attribution">?</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
