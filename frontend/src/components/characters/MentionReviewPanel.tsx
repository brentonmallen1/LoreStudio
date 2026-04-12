import { useState } from "react";
import { Search, ChevronLeft, ChevronRight, Tag, Loader } from "lucide-react";
import { api } from "../../api/client";
import type {
  CharacterUnlinkedMentionsResponse,
  SceneWithUnlinkedMentions,
  UnlinkedMentionProposal,
} from "../../types";
import styles from "./MentionReviewPanel.module.css";

interface Props {
  characterId: string;
  characterName: string;
  onApplied?: () => void;
}

export default function MentionReviewPanel({ characterId, characterName, onApplied }: Props) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [data, setData] = useState<CharacterUnlinkedMentionsResponse | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({}); // scene_id → Set of proposal ids

  async function loadMentions() {
    setLoading(true);
    try {
      const result = await api.getCharacterUnlinkedMentions(characterId);
      setData(result);
      setSceneIndex(0);
      setSelected({});
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function toggleProposal(scene: SceneWithUnlinkedMentions, proposal: UnlinkedMentionProposal) {
    setSelected((prev) => {
      const next = { ...prev };
      const sceneSet = new Set(next[scene.scene_id] ?? []);
      if (sceneSet.has(proposal.id)) {
        sceneSet.delete(proposal.id);
      } else {
        sceneSet.add(proposal.id);
      }
      next[scene.scene_id] = sceneSet;
      return next;
    });
  }

  function selectAll(scene: SceneWithUnlinkedMentions) {
    setSelected((prev) => ({
      ...prev,
      [scene.scene_id]: new Set(scene.proposals.map((p) => p.id)),
    }));
  }

  const totalSelected = Object.values(selected).reduce((sum, s) => sum + s.size, 0);

  async function applySelected() {
    if (!data) return;
    setApplying(true);
    try {
      const scenes = data.scenes
        .filter((s) => selected[s.scene_id]?.size)
        .map((s) => ({
          scene_id: s.scene_id,
          proposals: s.proposals
            .filter((p) => selected[s.scene_id]?.has(p.id))
            .map((p) => ({ id: p.id, matched_text: p.matched_text })),
        }));
      await api.applyCharacterMentions(characterId, scenes);
      // Reload to reflect applied mentions
      const updated = await api.getCharacterUnlinkedMentions(characterId);
      setData(updated);
      setSceneIndex(0);
      setSelected({});
      onApplied?.();
    } catch {
      // ignore
    } finally {
      setApplying(false);
    }
  }

  const currentScene = data?.scenes[sceneIndex];

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button onClick={loadMentions} disabled={loading} className={styles.checkBtn}>
          {loading ? <Loader size={12} className={styles.spinner} /> : <Search size={12} />}
          {loading ? "Scanning…" : "Check for untagged mentions"}
        </button>
        {data && (
          <span className={styles.countBadge}>
            {data.total_unlinked === 0
              ? "All mentions tagged"
              : `${data.total_unlinked} untagged mention${data.total_unlinked !== 1 ? "s" : ""} in ${data.scenes.length} scene${data.scenes.length !== 1 ? "s" : ""}`}
          </span>
        )}
      </div>

      {data && data.scenes.length > 0 && currentScene && (
        <div className={styles.browser}>
          {/* Scene nav */}
          <div className={styles.sceneNav}>
            <button
              className={styles.navBtn}
              onClick={() => setSceneIndex((i) => i - 1)}
              disabled={sceneIndex === 0}
            >
              <ChevronLeft size={13} />
            </button>
            <span className={styles.sceneTitle}>
              {currentScene.scene_title}
              <span className={styles.sceneCounter}> ({sceneIndex + 1}/{data.scenes.length})</span>
            </span>
            <button
              className={styles.navBtn}
              onClick={() => setSceneIndex((i) => i + 1)}
              disabled={sceneIndex === data.scenes.length - 1}
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Proposals */}
          <div className={styles.proposals}>
            <div className={styles.proposalHeader}>
              <span className={styles.proposalHint}>Select mentions to tag as @{characterName}</span>
              <button
                className={styles.selectAllBtn}
                onClick={() => selectAll(currentScene)}
              >
                Select all
              </button>
            </div>
            {currentScene.proposals.map((p) => {
              const isSelected = selected[currentScene.scene_id]?.has(p.id) ?? false;
              return (
                <label key={p.id} className={`${styles.proposalRow} ${isSelected ? styles.proposalSelected : ""}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleProposal(currentScene, p)}
                    className={styles.checkbox}
                  />
                  <span className={styles.matchedText}>{p.matched_text}</span>
                  <span className={styles.arrow}>→</span>
                  <span className={styles.tagPreview}>@{characterName}</span>
                  <span className={styles.excerpt}>"{p.source_excerpt}"</span>
                  {p.confidence < 1.0 && (
                    <span className={styles.confidenceLow} title={`Confidence: ${Math.round(p.confidence * 100)}%`}>
                      partial match
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          {totalSelected > 0 && (
            <button
              onClick={applySelected}
              disabled={applying}
              className={styles.applyBtn}
            >
              <Tag size={12} />
              {applying ? "Tagging…" : `Tag ${totalSelected} mention${totalSelected !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      )}

      {data && data.scenes.length === 0 && (
        <p className={styles.allClear}>No untagged mentions found — all references are linked.</p>
      )}
    </div>
  );
}
