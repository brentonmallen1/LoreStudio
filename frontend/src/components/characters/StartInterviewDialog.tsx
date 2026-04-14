import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, RefreshCw, Square, Feather, ExternalLink } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { Character, CharacterJourney, StructureNode, Interview } from "../../types";
import { Modal } from "../common";
import { useLLMStream } from "../../hooks/useLLMStream";
import styles from "./StartInterviewDialog.module.css";

interface Props {
  character: Character;
  onStarted: (interview: Interview) => void;
  onClose: () => void;
}

function flattenNodes(nodes: StructureNode[]): StructureNode[] {
  return nodes.flatMap((n) => [n, ...flattenNodes(n.children)]);
}

export default function StartInterviewDialog({ character, onStarted, onClose }: Props) {
  const { structure, activeStory } = useStoryStore();
  const navigate = useNavigate();
  const [contextNodeId, setContextNodeId] = useState<string>("");
  const [journey, setJourney] = useState<CharacterJourney | null>(null);
  const [loadingJourney, setLoadingJourney] = useState(false);
  const [starting, setStarting] = useState(false);
  const flatNodes = flattenNodes(structure);

  const { stream: streamRefresh, cancel: cancelRefresh, text: refreshStreamText, isStreaming: refreshing } = useLLMStream({
    requestId: `journey-refresh:${character.id}:${contextNodeId}`,
    label: "Refreshing journey context",
    tabId: "characters",
    onComplete: () => {
      // Reload the journey after refresh
      if (contextNodeId) loadJourney(contextNodeId);
    },
  });

  function loadJourney(nodeId: string) {
    setLoadingJourney(true);
    api.getCharacterJourney(character.id, nodeId)
      .then(setJourney)
      .catch(() => setJourney(null))
      .finally(() => setLoadingJourney(false));
  }

  useEffect(() => {
    if (!contextNodeId) { setJourney(null); return; }
    loadJourney(contextNodeId);
  }, [contextNodeId]);

  async function handleStart() {
    setStarting(true);
    try {
      const interview = await api.startInterview(
        character.id,
        `Interview with ${character.name}`,
        contextNodeId || undefined,
      );
      onStarted(interview);
    } finally {
      setStarting(false);
    }
  }

  function handleRefresh() {
    if (!contextNodeId) return;
    streamRefresh((signal) => api.refreshCharacterJourney(character.id, contextNodeId, signal));
  }

  const staleIndicatorClass =
    !journey || !journey.summary
      ? styles.indicatorNone
      : journey.is_stale
      ? styles.indicatorStale
      : styles.indicatorFresh;

  const footer = (
    <>
      <button onClick={onClose} className={styles.cancelBtn}>Cancel</button>
      <button
        onClick={handleStart}
        disabled={starting}
        className={styles.startBtn}
      >
        <MessageSquare size={13} />
        {starting ? "Starting…" : "Start Interview"}
      </button>
    </>
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Interview ${character.name}`}
      icon={<MessageSquare size={15} />}
      size="sm"
      footer={footer}
    >
      <div className={styles.body}>
        <div className={styles.field}>
          <label className={styles.label}>Story point (optional)</label>
          <p className={styles.hint}>
            Interview this character at a specific moment in the story — they'll respond
            with awareness of everything they've experienced up to that point.
          </p>
          <select
            value={contextNodeId}
            onChange={(e) => setContextNodeId(e.target.value)}
            className={styles.select}
          >
            <option value="">No story context — timeless interview</option>
            {flatNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {"  ".repeat(n.level)}{n.title}
              </option>
            ))}
          </select>
        </div>

        {contextNodeId && (
          <div className={styles.journeyPreview}>
            {loadingJourney ? (
              <p className={styles.journeyHint}>Loading context…</p>
            ) : journey ? (
              <>
                <div className={styles.journeyHeader}>
                  <span className={styles.journeyLabel}>
                    <span className={staleIndicatorClass} />
                    Journey context
                  </span>
                  <span className={styles.sceneCount}>
                    {journey.scene_count === 0
                      ? "No scenes found"
                      : `${journey.scene_count} scene${journey.scene_count !== 1 ? "s" : ""}`}
                  </span>
                  <button
                    className={styles.refreshBtn}
                    onClick={refreshing ? cancelRefresh : handleRefresh}
                    disabled={!refreshing && journey.scene_count === 0}
                    title={refreshing ? "Cancel refresh" : "Regenerate journey context"}
                  >
                    {refreshing ? <Square size={11} /> : <RefreshCw size={11} />}
                    {refreshing ? "Cancel" : "Refresh"}
                  </button>
                </div>

                {journey.is_stale && (
                  <div className={styles.staleWarning}>
                    <Feather size={11} />
                    Context may be outdated — scene summaries have changed. Refresh for accuracy.
                  </div>
                )}

                {refreshing && refreshStreamText ? (
                  <p className={styles.journeyText} style={{ fontStyle: "italic" }}>{refreshStreamText}</p>
                ) : journey.summary ? (
                  <p className={styles.journeyText}>{journey.summary}</p>
                ) : journey.scene_count === 0 ? (
                  <p className={styles.journeyHint}>
                    {character.name} doesn't appear in any summarized scenes before this point.{" "}
                    {activeStory ? (
                      <button
                        type="button"
                        className={styles.generateLink}
                        onClick={() => { onClose(); navigate(`/stories/${activeStory.id}/health`); }}
                      >
                        Generate scene summaries <ExternalLink size={10} />
                      </button>
                    ) : "Generate scene summaries"}{" "}
                    to enable context-aware interviews.
                  </p>
                ) : (
                  <p className={styles.journeyHint}>
                    Journey not yet generated. Click Refresh to build context from {journey.scene_count} scene{journey.scene_count !== 1 ? "s" : ""}.
                  </p>
                )}
              </>
            ) : (
              <p className={styles.journeyHint}>Unable to load journey context.</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
