import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessageSquare, ChevronRight, AlertCircle, ChevronUp, ChevronDown, MessageCircle, StickyNote } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type {
  DialogueBlockWithScene,
  VoiceDistinctnessResult,
  CharacterDialogueProseResult,
  VoiceFidelityResult,
} from "../../types";
import AutoTagPanel from "../cleanup/AutoTagPanel";
import CharacterDialogueActionToolbar from "./CharacterDialogueActionToolbar";
import styles from "./CharacterDialogueTab.module.css";

interface Props {
  characterId: string;
  characterName: string;
}

export default function CharacterDialogueTab({ characterId, characterName }: Props) {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { characters, structure, setActiveNode } = useStoryStore();
  const characterNames = characters.map((c) => c.name);
  const [blocks, setBlocks] = useState<DialogueBlockWithScene[]>([]);
  const [loading, setLoading] = useState(true);

  // Analysis results
  const [voiceResult, setVoiceResult] = useState<VoiceDistinctnessResult | null>(null);
  const [showVoice, setShowVoice] = useState(false);
  const [proseResult, setProseResult] = useState<CharacterDialogueProseResult | null>(null);
  const [showProse, setShowProse] = useState(false);
  const [fidelityResult, setFidelityResult] = useState<VoiceFidelityResult | null>(null);
  const [showFidelity, setShowFidelity] = useState(false);
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>({});

  const voicePanelRef = useRef<HTMLDivElement>(null);
  const prosePanelRef = useRef<HTMLDivElement>(null);
  const fidelityPanelRef = useRef<HTMLDivElement>(null);
  const [showSubtextNotes, setShowSubtextNotes] = useState(false);
  const [subtextDraft, setSubtextDraft] = useState<Record<string, string>>({});
  const [subtextOpen, setSubtextOpen] = useState<Set<string>>(new Set());
  const subtextTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function getSubtext(block: DialogueBlockWithScene) {
    return subtextDraft[block.id] ?? block.subtext ?? "";
  }

  function handleSubtextChange(blockId: string, value: string) {
    setSubtextDraft((prev) => ({ ...prev, [blockId]: value }));
    if (subtextTimers.current[blockId]) clearTimeout(subtextTimers.current[blockId]);
    subtextTimers.current[blockId] = setTimeout(() => {
      api.patchDialogueBlock(blockId, { subtext: value });
      delete subtextTimers.current[blockId];
    }, 900);
  }

  function toggleSubtextOpen(blockId: string) {
    setSubtextOpen((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }

  async function navigateToScene(sceneId: string) {
    try {
      const fullNode = await api.getNode(sceneId);
      setActiveNode(fullNode);
    } catch {
      const queue = [...structure];
      while (queue.length) {
        const n = queue.shift()!;
        if (n.id === sceneId) { setActiveNode(n); break; }
        if (n.children) queue.push(...n.children);
      }
    }
    navigate(`/stories/${storyId}/write`);
  }

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

  const hasDialogue = blocks.length > 0;

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

  const focusProfile = voiceResult?.profiles.find((p) => p.character_id === characterId);
  const similarToFocus = voiceResult?.similar_pairs.filter(
    (p) => p.char_a_id === characterId || p.char_b_id === characterId
  ) ?? [];

  const fidelityColorClass = (fidelity: string) => {
    if (fidelity === "excellent") return styles.fidelityExcellent;
    if (fidelity === "good") return styles.fidelityGood;
    if (fidelity === "fair") return styles.fidelityFair;
    return styles.fidelityNeedsWork;
  };

  const severityClass = (severity: string) => {
    if (severity === "issue") return styles.severityIssue;
    if (severity === "warning") return styles.severityWarning;
    return styles.severityInfo;
  };

  return (
    <div className={styles.root}>
      {/* ── Dialogue Analysis toolbar ── */}
      {storyId && (
        <CharacterDialogueActionToolbar
          characterId={characterId}
          storyId={storyId}
          hasDialogue={hasDialogue}
          onVoiceResult={(r) => {
            setVoiceResult(r);
            setShowVoice(true);
            setTimeout(() => voicePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
          }}
          onProseResult={(r) => {
            setProseResult(r);
            setShowProse(true);
            setTimeout(() => prosePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
          }}
          onFidelityResult={(r) => {
            setFidelityResult(r);
            setShowFidelity(true);
            setTimeout(() => fidelityPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
          }}
          onError={(id, msg) => setAnalysisErrors((prev) => ({ ...prev, [id]: msg }))}
        />
      )}

      {/* Analysis errors */}
      {Object.values(analysisErrors).map((msg, i) => (
        <span key={i} className={styles.analysisError}>{msg}</span>
      ))}

      {/* ── Tag Dialogue panel ── */}
      {storyId && (
        <AutoTagPanel
          mode="character"
          storyId={storyId}
          characterId={characterId}
          characterName={characterName}
          characterNames={characterNames}
          onApplied={() => api.getCharacterDialogue(characterId).then(setBlocks).catch(() => {})}
        />
      )}

      {!hasDialogue && (
        <div className={styles.empty}>
          <MessageSquare size={24} className={styles.emptyIcon} />
          <p>No attributed dialogue found for {characterName}.</p>
          <p className={styles.emptyHint}>
            Add explicit attribution using <code>"text"&lt;{characterName}&gt;</code> or use the
            panel above to find and tag unattributed quotes.
          </p>
        </div>
      )}

      {/* ── Voice results ── */}
      {voiceResult && showVoice && (
        <div ref={voicePanelRef} className={styles.voicePanel}>
          <div className={styles.voicePanelHeader}>
            <span className={styles.voiceTitle}>
              Voice Analysis
              <span className={`${styles.distinctnessBadge} ${styles[`distinctness_${voiceResult.overall_distinctness}`]}`}>
                {voiceResult.overall_distinctness.replace("_", " ")}
              </span>
            </span>
            <button onClick={() => setShowVoice(false)} className={styles.voiceClose}>
              <ChevronUp size={12} />
            </button>
          </div>

          {focusProfile && (
            <div className={styles.voiceProfile}>
              <div className={styles.profileStat}>
                <span className={styles.profileLabel}>Vocabulary richness</span>
                <span className={styles.profileValue}>{Math.round(focusProfile.vocabulary_richness * 100)}%</span>
              </div>
              <div className={styles.profileStat}>
                <span className={styles.profileLabel}>Avg sentence length</span>
                <span className={styles.profileValue}>{focusProfile.avg_sentence_length} words</span>
              </div>
              <div className={styles.profileStat}>
                <span className={styles.profileLabel}>Questions</span>
                <span className={styles.profileValue}>{Math.round(focusProfile.question_ratio * 100)}%</span>
              </div>
              <div className={styles.profileStat}>
                <span className={styles.profileLabel}>Exclamations</span>
                <span className={styles.profileValue}>{Math.round(focusProfile.exclamation_ratio * 100)}%</span>
              </div>
              {focusProfile.signature_words.length > 0 && (
                <div className={styles.signatureWords}>
                  <span className={styles.profileLabel}>Signature words:</span>
                  {focusProfile.signature_words.map((w) => (
                    <span key={w} className={styles.signatureWord}>{w}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {similarToFocus.length > 0 && (
            <div className={styles.similarityWarnings}>
              <p className={styles.similarityTitle}>Voice overlap detected</p>
              {similarToFocus.map((pair) => {
                const otherName = pair.char_a_id === characterId ? pair.char_b_name : pair.char_a_name;
                return (
                  <div key={`${pair.char_a_id}-${pair.char_b_id}`} className={styles.similarityRow}>
                    <span className={styles.similarityNames}>
                      {characterName} ↔ {otherName}
                    </span>
                    <span className={styles.similarityScore} title="Similarity score (higher = more similar)">
                      {Math.round(pair.similarity_score * 100)}% similar
                    </span>
                    {pair.shared_patterns.length > 0 && (
                      <span className={styles.sharedPatterns}>
                        shared: {pair.shared_patterns.join(", ")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {similarToFocus.length === 0 && focusProfile && (
            <p className={styles.voiceClear}>Voice is distinct from other characters.</p>
          )}
        </div>
      )}

      {/* ── Prose analysis results ── */}
      {proseResult && showProse && (
        <div ref={prosePanelRef} className={styles.voicePanel}>
          <div className={styles.voicePanelHeader}>
            <span className={styles.voiceTitle}>Dialogue Prose Analysis</span>
            <button onClick={() => setShowProse(false)} className={styles.voiceClose}>
              <ChevronUp size={12} />
            </button>
          </div>
          <div className={styles.voiceProfile}>
            <div className={styles.profileStat}>
              <span className={styles.profileLabel}>Lines analyzed</span>
              <span className={styles.profileValue}>{proseResult.line_count}</span>
            </div>
            <div className={styles.profileStat}>
              <span className={styles.profileLabel}>Words</span>
              <span className={styles.profileValue}>{proseResult.word_count.toLocaleString()}</span>
            </div>
            {proseResult.sentence_variety && (
              <>
                <div className={styles.profileStat}>
                  <span className={styles.profileLabel}>Avg sentence</span>
                  <span className={`${styles.profileValue} ${proseResult.sentence_variety.assessment === "monotonous" ? styles.profileWarn : ""}`}>
                    {proseResult.sentence_variety.mean_length}w
                  </span>
                </div>
                <div className={styles.profileStat}>
                  <span className={styles.profileLabel}>Variety</span>
                  <span className={`${styles.profileValue} ${proseResult.sentence_variety.assessment === "monotonous" ? styles.profileWarn : ""}`}>
                    {proseResult.sentence_variety.assessment}
                  </span>
                </div>
              </>
            )}
            {proseResult.adverb_overuse && proseResult.adverb_overuse.adverb_count > 0 && (
              <div className={styles.profileStat}>
                <span className={styles.profileLabel}>-ly adverbs</span>
                <span className={`${styles.profileValue} ${proseResult.adverb_overuse.percentage > 5 ? styles.profileWarn : ""}`}>
                  {proseResult.adverb_overuse.adverb_count} ({proseResult.adverb_overuse.percentage}%)
                </span>
              </div>
            )}
          </div>

          {proseResult.said_bookisms && proseResult.said_bookisms.bookism_count > 0 && (
            <div className={styles.similarityWarnings}>
              <p className={styles.similarityTitle}>
                Said bookisms: {proseResult.said_bookisms.bookism_count} of {proseResult.said_bookisms.total_attributions} attributions
              </p>
              {proseResult.said_bookisms.findings.slice(0, 5).map((f, i) => (
                <div key={i} className={styles.similarityRow}>
                  <span className={styles.excerpt}>"{f.passage.slice(0, 80)}{f.passage.length > 80 ? "…" : ""}"</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Voice Fidelity results ── */}
      {fidelityResult && showFidelity && (
        <div ref={fidelityPanelRef} className={styles.voicePanel}>
          <div className={styles.voicePanelHeader}>
            <span className={styles.voiceTitle}>
              Voice Fidelity
              <span className={`${styles.distinctnessBadge} ${fidelityColorClass(fidelityResult.overall_fidelity)}`}>
                {fidelityResult.overall_fidelity.replace("_", " ")}
              </span>
            </span>
            <button onClick={() => setShowFidelity(false)} className={styles.voiceClose}>
              <ChevronUp size={12} />
            </button>
          </div>

          {fidelityResult.attribute_summary && (
            <p className={styles.fidelityAttributeSummary}>{fidelityResult.attribute_summary}</p>
          )}

          {fidelityResult.summary && (
            <p className={styles.fidelitySummary}>{fidelityResult.summary}</p>
          )}

          {/* Findings — issues and warnings only */}
          {fidelityResult.findings.filter((f) => f.severity !== "info").length > 0 && (
            <div className={styles.fidelityFindings}>
              {fidelityResult.findings
                .filter((f) => f.severity !== "info")
                .map((finding, i) => (
                  <div key={i} className={`${styles.findingRow} ${severityClass(finding.severity)}`}>
                    {finding.dialogue_excerpt && (
                      <p className={styles.findingExcerpt}>
                        "{finding.dialogue_excerpt.slice(0, 100)}{finding.dialogue_excerpt.length > 100 ? "…" : ""}"
                      </p>
                    )}
                    <p className={styles.findingExplanation}>{finding.explanation}</p>
                    {finding.attribute_context && (
                      <p className={styles.findingContext}>{finding.attribute_context}</p>
                    )}
                    {finding.suggestion && (
                      <p className={styles.findingSuggestion}>{finding.suggestion}</p>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Authentic examples */}
          {fidelityResult.authentic_examples.length > 0 && (
            <div className={styles.authenticSection}>
              <p className={styles.similarityTitle}>Lines that ring true</p>
              {fidelityResult.authentic_examples.slice(0, 4).map((ex, i) => (
                <p key={i} className={styles.authenticExample}>
                  "{ex.slice(0, 100)}{ex.length > 100 ? "…" : ""}"
                </p>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {fidelityResult.recommendations.length > 0 && (
            <div className={styles.fidelityRecommendations}>
              <p className={styles.similarityTitle}>Recommendations</p>
              <ul className={styles.recommendationList}>
                {fidelityResult.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {hasDialogue && (
        <>
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
                onClick={() => storyId && navigateToScene(sceneId)}
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
                  const hasSubtext = !!(getSubtext(block));
                  const isSubtextOpen = subtextOpen.has(block.id);
                  return (
                    <div
                      key={block.id}
                      className={`${styles.line} ${isInferred ? styles.lineInferred : ""} ${isThought ? styles.lineThought : ""}`}
                    >
                      <div className={styles.lineRow}>
                        {isThought ? (
                          <span className={styles.lineContent}><em>{block.content}</em></span>
                        ) : (
                          <span className={styles.lineContent}>"{block.content}"</span>
                        )}
                        <div className={styles.lineBadges}>
                          {isThought && <span className={styles.thoughtBadge} title="Inner monologue">thought</span>}
                          {!isThought && isInferred && (
                            <span className={styles.inferredBadge} title="Inferred attribution">?</span>
                          )}
                          <button
                            className={`${styles.subtextBtn} ${hasSubtext ? styles.subtextBtnActive : ""}`}
                            onClick={() => toggleSubtextOpen(block.id)}
                            title={hasSubtext ? "View/edit subtext note" : "Add subtext note"}
                          >
                            <MessageCircle size={11} />
                          </button>
                        </div>
                      </div>
                      {isSubtextOpen && (
                        <textarea
                          className={styles.subtextField}
                          value={getSubtext(block)}
                          onChange={(e) => handleSubtextChange(block.id, e.target.value)}
                          placeholder="What does this character really mean? (subtext note)"
                          rows={2}
                        />
                      )}
                      {!isSubtextOpen && hasSubtext && (
                        <p className={styles.subtextPreview}>{getSubtext(block)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* ── Subtext Notes section ── */}
          {blocks.some((b) => getSubtext(b)) && (
            <div className={styles.subtextSection}>
              <button
                className={styles.subtextSectionHeader}
                onClick={() => setShowSubtextNotes((v) => !v)}
              >
                <StickyNote size={13} className={styles.subtextSectionIcon} />
                <span>Subtext Notes</span>
                <span className={styles.subtextSectionCount}>
                  {blocks.filter((b) => getSubtext(b)).length}
                </span>
                {showSubtextNotes ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showSubtextNotes && (
                <div className={styles.subtextNotesList}>
                  {Array.from(sceneMap.entries()).map(([sceneId, { title, blocks: sceneBlocks }]) => {
                    const withSubtext = sceneBlocks.filter((b) => getSubtext(b));
                    if (!withSubtext.length) return null;
                    return (
                      <div key={sceneId} className={styles.subtextSceneGroup}>
                        <p className={styles.subtextSceneTitle}>{title}</p>
                        {withSubtext.map((block) => (
                          <div key={block.id} className={styles.subtextNoteRow}>
                            <p className={styles.subtextNoteQuote}>"{block.content.slice(0, 80)}{block.content.length > 80 ? "…" : ""}"</p>
                            <p className={styles.subtextNoteText}>{getSubtext(block)}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
