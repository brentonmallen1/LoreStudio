import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Compass, Quote, Tag } from "lucide-react";
import { api } from "../../api/client";
import type { Character, DialogueBlock, ProposedDialogueTag, Story, StructureNode } from "../../types";
import { useAIAvailable } from "../../lib/mode";
import AttributionChecks from "./AttributionChecks";
import styles from "./SceneEditor.module.css";

interface Props {
  activeNode: StructureNode;
  activeStory: Story | null;
  characters: Character[];
  editor: Editor | null;
  setActiveNode: (node: StructureNode) => void;
  onExit: () => void;
  onOpenAutoTag: () => void;
}

/** First speaker left, second right, alternating on change. */
function assignSides(blocks: DialogueBlock[]): Map<string, "left" | "right"> {
  const sides = new Map<string, "left" | "right">();
  let next: "left" | "right" = "left";
  for (const b of blocks) {
    const key = b.speaker_name || "__unknown__";
    if (!sides.has(key)) {
      sides.set(key, next);
      next = next === "left" ? "right" : "left";
    }
  }
  return sides;
}

/** "Dialogue only" view: every quoted line as a chat bubble, with AI speaker suggestions for the untagged ones. */
export default function DialogueIsolationView({
  activeNode,
  activeStory,
  characters,
  editor,
  setActiveNode,
  onExit,
  onOpenAutoTag,
}: Props) {
  const studio = useAIAvailable();
  const [blocks, setBlocks] = useState<DialogueBlock[]>([]);
  const [suggestions, setSuggestions] = useState<ProposedDialogueTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  // The server reads the lines from the saved prose, so read again after every save: the
  // view can open while the editor's last keystrokes are still on their way.
  useEffect(() => {
    let current = true;
    api
      .listDialogue(activeNode.id)
      .then((b) => current && setBlocks(b))
      .catch(() => current && setBlocks([]));
    return () => {
      current = false;
    };
  }, [activeNode.id, activeNode.updated_at]);

  useEffect(
    () => () => {
      setSuggestions([]);
      setDismissed(new Set());
    },
    [activeNode.id],
  );

  async function suggest() {
    if (loading) {
      abortRef.current?.abort();
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setDismissed(new Set());
    try {
      setSuggestions(await api.aiSuggestDialogueSpeakers(activeNode.id, ctrl.signal));
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  async function accept(block: DialogueBlock, suggestion: ProposedDialogueTag) {
    if (!suggestion.inferred_speaker) return;
    try {
      const updated = await api.applyDialogueTags(activeNode.id, [
        { quote_content: block.content, speaker_name: suggestion.inferred_speaker },
      ]);
      setActiveNode({ ...activeNode, ...updated });
      if (editor && updated.content) editor.commands.setContent(updated.content, false);
      setDismissed((prev) => new Set([...prev, suggestion.id]));
    } catch {
      /* ignore */
    }
  }

  const isPovMode =
    activeStory?.narrative_perspective === "first_person" ||
    activeStory?.narrative_perspective === "multiple_pov";
  const povId = activeNode.pov_character_id || activeStory?.pov_character_id || null;
  const povChar = povId ? characters.find((c) => c.id === povId) : null;

  const sideMap = assignSides(blocks);

  return (
    <div className={styles.dialogueIsolationView}>
      <div className={styles.dialogueIsolationHeader}>
        <Quote size={13} />
        Dialogue only,{" "}
        <button className={styles.dialogueIsolationExit} onClick={onExit}>
          back to prose
        </button>
        <div className={styles.dialogueIsolationActions}>
          {studio && (
            <button
              className={`${styles.dialogueIsolationBtn} ${styles.dialogueIsolationBtnAI} ${loading ? styles.dialogueIsolationBtnLoading : ""}`}
              title={loading ? "Cancel" : "Auto-Tag: use AI to infer speakers for unattributed dialogue"}
              onClick={suggest}
            >
              <Compass size={11} className={loading ? styles.spinIcon : ""} />
              {loading ? "Cancel" : "Auto-Tag"}
            </button>
          )}
          <button
            className={styles.dialogueIsolationBtn}
            title="Tag Suggestions: review heuristic speaker proposals for untagged quotes"
            onClick={onOpenAutoTag}
          >
            <Tag size={11} />
            Tag Suggestions
          </button>
        </div>
      </div>
      {activeStory && <AttributionChecks storyId={activeStory.id} nodeId={activeNode.id} />}
      {blocks.length === 0 ? (
        <p className={styles.dialogueIsolationEmpty}>
          No dialogue in this scene. Quoted lines appear here; attribute one with{" "}
          <code>"text"&lt;Name&gt;</code> or <code>^</code>.
        </p>
      ) : (
        <div className={styles.dialogueBubbles}>
          {blocks.map((b) => {
            const isThought = b.dialogue_type === "thought";
            const side = sideMap.get(b.speaker_name || "__unknown__")!;
            const isInferred = b.attribution_method === "inferred" || b.attribution_method === "alternating";
            const isPovDefault = b.attribution_method === "pov_default";
            const isUnattr = b.attribution_method === "unattributed";
            const isPovSpeaker =
              isPovMode && povChar && b.speaker_name.toLowerCase() === povChar.name.toLowerCase();
            const suggestion = isUnattr
              ? suggestions.find(
                  (s) =>
                    !dismissed.has(s.id) &&
                    s.quote_content.trim().toLowerCase() === b.content.trim().toLowerCase(),
                )
              : undefined;
            return (
              <div
                key={b.id}
                className={`${styles.dialogueBubbleWrap} ${side === "right" ? styles.dialogueBubbleWrapRight : ""}`}
              >
                {isThought ? (
                  <div className={styles.dialogueBubbleSpeaker}>
                    {isPovSpeaker ? null : b.speaker_name || "Unknown"}
                    <span className={styles.dialogueBubbleThoughtLabel}>thought</span>
                  </div>
                ) : isPovSpeaker ? (
                  <div className={styles.dialogueBubbleSpeaker}>
                    <span className={styles.dialogueBubblePovLabel}>I</span>
                    {isPovDefault && <span className={styles.dialogueBubbleInferred}>pov</span>}
                  </div>
                ) : (
                  <div className={styles.dialogueBubbleSpeaker}>
                    {b.speaker_name || "Unknown"}
                    {isInferred && <span className={styles.dialogueBubbleInferred}>?</span>}
                  </div>
                )}
                <div
                  className={[
                    styles.dialogueBubble,
                    side === "right" ? styles.dialogueBubbleRight : styles.dialogueBubbleLeft,
                    isUnattr ? styles.dialogueBubbleUnattr : "",
                    isThought ? styles.dialogueBubbleThought : "",
                    isPovSpeaker && !isThought ? styles.dialogueBubblePov : "",
                  ].join(" ")}
                >
                  {isThought ? <em>{b.content}</em> : `"${b.content}"`}
                </div>
                {suggestion && (
                  <div className={styles.aiSuggestionRow}>
                    <Compass size={10} className={styles.aiSuggestionIcon} />
                    <span className={styles.aiSuggestionSpeaker}>{suggestion.inferred_speaker}</span>
                    {suggestion.source_excerpt && (
                      <span className={styles.aiSuggestionReason}>{suggestion.source_excerpt}</span>
                    )}
                    <button
                      className={styles.aiSuggestionAccept}
                      title="Accept this attribution"
                      onClick={() => accept(b, suggestion)}
                    >
                      ✓
                    </button>
                    <button
                      className={styles.aiSuggestionDismiss}
                      title="Dismiss this suggestion"
                      onClick={() => setDismissed((prev) => new Set([...prev, suggestion.id]))}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
