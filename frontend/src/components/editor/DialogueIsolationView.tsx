import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Orbit, Quote, Tag } from "lucide-react";
import { api } from "../../api/client";
import type { Character, DialogueBlock, ProposedDialogueTag, Story, StructureNode } from "../../types";
import { useAIAvailable } from "../../lib/mode";
import { assignSides } from "../../lib/dialogue/sides";
import { speakerChoices } from "../../lib/dialogue/speakerChoices";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import SpeakerPicker from "./SpeakerPicker";
import AttributionChecks from "./AttributionChecks";
import { patchScene } from "../../lib/undo/sceneHistory";
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

/**
 * "Dialogue only" view: every quoted line as a chat bubble. An untagged or guessed line's
 * "Unknown" or "?" picks who says it (doc 24, D17); in Studio the Assistant can suggest too.
 */
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
  const [tagging, setTagging] = useState(false);
  const sceneCast = useStoryStore((s) => s.sceneCast);

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

  /**
   * Tag one line with its speaker: the server writes `"…"<Name>` into the prose as one
   * undoable change, and the open scene takes the new text through the undo-safe path. The
   * new `updated_at` reads the lines again.
   */
  async function tagLine(block: DialogueBlock, speaker: string): Promise<boolean> {
    setTagging(true);
    try {
      const updated = await api.applyDialogueTags(activeNode.id, [
        { quote_content: block.content, speaker_name: speaker },
      ]);
      setActiveNode({ ...activeNode, ...updated });
      if (editor && updated.content) patchScene(editor, updated.content);
      return true;
    } catch {
      toast.error(`Couldn't tag that line as ${speaker}.`);
      return false;
    } finally {
      setTagging(false);
    }
  }

  async function accept(block: DialogueBlock, suggestion: ProposedDialogueTag) {
    if (!suggestion.inferred_speaker) return;
    if (await tagLine(block, suggestion.inferred_speaker))
      setDismissed((prev) => new Set([...prev, suggestion.id]));
  }

  const isPovMode =
    activeStory?.narrative_perspective === "first_person" ||
    activeStory?.narrative_perspective === "multiple_pov";
  const povId = activeNode.pov_character_id || activeStory?.pov_character_id || null;
  const povChar = povId ? characters.find((c) => c.id === povId) : null;

  // The side flips when the speaker changes; a run by one speaker is grouped, named once.
  const placed = assignSides(blocks.map((b) => b.speaker_name));

  const choices = useMemo(
    () =>
      speakerChoices(characters, {
        povId: activeNode.pov_character_id || activeStory?.pov_character_id || null,
        sceneCharacterIds: sceneCast?.scenes.find((s) => s.node_id === activeNode.id)?.character_ids ?? [],
        speakerNames: blocks.map((b) => b.speaker_name),
      }),
    [
      characters,
      activeNode.id,
      activeNode.pov_character_id,
      activeStory?.pov_character_id,
      sceneCast,
      blocks,
    ],
  );

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
              <Orbit size={11} className={loading ? styles.spinIcon : ""} />
              {loading ? "Cancel" : "Auto-Tag"}
            </button>
          )}
          <button
            className={styles.dialogueIsolationBtn}
            title="Tag the dialogue: review suggested speakers for untagged quotes"
            onClick={onOpenAutoTag}
          >
            <Tag size={11} />
            Tag the dialogue
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
          {blocks.map((b, i) => {
            const isThought = b.dialogue_type === "thought";
            const { side, runStart } = placed[i];
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
            // The name heads a run only; a line's own marks (thought, a guessed speaker) stay.
            // An untagged line's "Unknown", or a guessed one's "?", picks who says it.
            const align = side === "right" ? "end" : "start";
            const name = isPovSpeaker ? (
              isThought ? null : (
                <span className={styles.dialogueBubblePovLabel}>I</span>
              )
            ) : isUnattr || !b.speaker_name ? (
              <SpeakerPicker
                label="Unknown speaker: choose who says this line"
                trigger={<span className={styles.speakerUnknown}>Unknown</span>}
                choices={choices}
                align={align}
                disabled={tagging}
                onPick={(c) => tagLine(b, c.name)}
              />
            ) : (
              b.speaker_name
            );
            const mark = isThought ? (
              <span className={styles.dialogueBubbleThoughtLabel}>thought</span>
            ) : isPovSpeaker ? (
              isPovDefault && <span className={styles.dialogueBubbleInferred}>pov</span>
            ) : (
              isInferred && (
                <SpeakerPicker
                  label={`? ${b.speaker_name} is a guess: choose who says this line`}
                  trigger={<span className={styles.dialogueBubbleInferred}>?</span>}
                  choices={choices}
                  align={align}
                  disabled={tagging}
                  onPick={(c) => tagLine(b, c.name)}
                />
              )
            );
            return (
              <div
                key={b.id}
                className={[
                  styles.dialogueBubbleWrap,
                  side === "right" ? styles.dialogueBubbleWrapRight : "",
                  side === "centre" ? styles.dialogueBubbleWrapCentre : "",
                  runStart ? "" : styles.dialogueBubbleWrapCont,
                ].join(" ")}
              >
                {(runStart || mark) && (
                  <div className={styles.dialogueBubbleSpeaker}>
                    {runStart && name}
                    {mark}
                  </div>
                )}
                <div
                  className={[
                    styles.dialogueBubble,
                    side === "right"
                      ? styles.dialogueBubbleRight
                      : side === "centre"
                        ? styles.dialogueBubbleCentre
                        : styles.dialogueBubbleLeft,
                    isUnattr && side !== "centre" ? styles.dialogueBubbleUnattr : "",
                    isThought ? styles.dialogueBubbleThought : "",
                    isPovSpeaker && !isThought ? styles.dialogueBubblePov : "",
                  ].join(" ")}
                >
                  {isThought ? <em>{b.content}</em> : `"${b.content}"`}
                </div>
                {suggestion && (
                  <div className={styles.aiSuggestionRow}>
                    <Orbit size={10} className={styles.aiSuggestionIcon} />
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
