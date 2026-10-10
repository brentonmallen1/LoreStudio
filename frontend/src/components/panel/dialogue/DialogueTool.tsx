import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Orbit, Square, Tag } from "lucide-react";
import { api } from "../../../api/client";
import type { DialogueBlock, ProposedDialogueTag, StructureNode } from "../../../types";
import { useAIAvailable } from "../../../lib/mode";
import { assignSides } from "../../../lib/dialogue/sides";
import { speakerChoices } from "../../../lib/dialogue/speakerChoices";
import { layInRewrite, saveOpenScene } from "../../../lib/panel/panelSync";
import { useStoryStore } from "../../../stores/storyStore";
import { toast } from "../../../stores/toastStore";
import AIFeatureInfoTrigger from "../../ai/AIFeatureInfoTrigger";
import AttributionChecks from "./AttributionChecks";
import AutoTagDialoguePanel from "../../story/AutoTagDialoguePanel";
import DialogueLine from "./DialogueLine";
import styles from "./Dialogue.module.css";

/**
 * The open scene's dialogue as a thread, beside the prose (doc 24 D8): the side flips each
 * time the speaker changes, a run by one speaker stacks under one name, and a line with no
 * speaker sits in the middle with a picker that tags it (D17). It follows the scene the prose
 * has open. Tagging is the author's choice, so it is in Writer mode too; the Assistant's
 * suggestions are Studio's.
 */
export default function DialogueTool() {
  const { activeNode, activeStory } = useStoryStore();
  if (!activeNode || !activeStory) {
    return <p className={styles.empty}>Open a scene and its dialogue appears here.</p>;
  }
  if ((activeNode.children?.length ?? 0) > 0) {
    return (
      <p className={styles.empty}>
        {activeNode.title} holds scenes: open one of them and its dialogue appears here.
      </p>
    );
  }
  return <SceneDialogue key={activeNode.id} node={activeNode} storyId={activeStory.id} />;
}

function SceneDialogue({ node, storyId }: { node: StructureNode; storyId: string }) {
  const studio = useAIAvailable();
  const { activeStory, characters, sceneCast } = useStoryStore();
  const [blocks, setBlocks] = useState<DialogueBlock[] | null>(null);
  const [suggestions, setSuggestions] = useState<ProposedDialogueTag[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [suggesting, setSuggesting] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [autoTag, setAutoTag] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // The server reads the lines from the saved prose, so read again after every save.
  useEffect(() => {
    let current = true;
    api
      .listDialogue(node.id)
      .then((b) => current && setBlocks(b))
      .catch(() => current && setBlocks([]));
    return () => {
      current = false;
    };
  }, [node.id, node.updated_at]);
  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * The scene with the server's rewrite in it: the store, and the open editor outside its
   * history, in whichever window has it (the editor stays in the main one when the panel is
   * popped out).
   */
  function applyUpdated(updated: Partial<StructureNode>) {
    layInRewrite({ ...updated, id: node.id });
  }

  /**
   * Tag one line with its speaker: the server writes `"…"<Name>` into the prose as one
   * undoable change. What is typed but not saved goes first, so the rewrite is of the
   * current text.
   */
  async function tagLine(block: DialogueBlock, speaker: string): Promise<boolean> {
    setTagging(true);
    try {
      await saveOpenScene(node.id);
      const updated = await api.applyDialogueTags(node.id, [
        { quote_content: block.content, speaker_name: speaker },
      ]);
      applyUpdated(updated);
      return true;
    } catch {
      toast.error(`Couldn't tag that line as ${speaker}.`);
      return false;
    } finally {
      setTagging(false);
    }
  }

  async function suggest() {
    if (suggesting) {
      abortRef.current?.abort();
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSuggesting(true);
    setDismissed(new Set());
    try {
      setSuggestions(await api.aiSuggestDialogueSpeakers(node.id, ctrl.signal));
    } catch {
      setSuggestions([]);
    } finally {
      setSuggesting(false);
      abortRef.current = null;
    }
  }

  const lines = blocks ?? [];
  const unattributed = (b: DialogueBlock) => b.attribution_method === "unattributed" || !b.speaker_name;
  const placed = assignSides(lines.map((b) => (unattributed(b) ? "" : b.speaker_name)));
  const povId = node.pov_character_id || activeStory?.pov_character_id || null;
  const firstPerson =
    activeStory?.narrative_perspective === "first_person" ||
    activeStory?.narrative_perspective === "multiple_pov";
  const povName = firstPerson && povId ? characters.find((c) => c.id === povId)?.name : undefined;
  const choices = useMemo(
    () =>
      speakerChoices(characters, {
        povId,
        sceneCharacterIds: sceneCast?.scenes.find((s) => s.node_id === node.id)?.character_ids ?? [],
        speakerNames: (blocks ?? []).map((b) => b.speaker_name),
      }),
    [characters, povId, sceneCast, node.id, blocks],
  );

  return (
    <section className={styles.tool} aria-label="Dialogue">
      <div className={styles.head}>
        <MessageSquare size={15} className={styles.headIcon} aria-hidden />
        <h3 className={styles.title}>Dialogue</h3>
        <span className={styles.scene} title={node.title}>
          · {node.title || "this scene"}
        </span>
        <span className={styles.spacer} />
        {studio && <AIFeatureInfoTrigger pageId="scene-editor" />}
        {studio && (
          <button
            type="button"
            className={styles.ai}
            title={suggesting ? "Cancel" : "The Assistant suggests who says each untagged line"}
            onClick={suggest}
          >
            {suggesting ? <Square size={12} aria-hidden /> : <Orbit size={12} aria-hidden />}
            {suggesting ? "Cancel" : "Suggest speakers"}
          </button>
        )}
        <button
          type="button"
          className={styles.tag}
          title="Find quotes with no speaker and tag them"
          onClick={() => setAutoTag(true)}
        >
          <Tag size={12} aria-hidden />
          Tag the dialogue
        </button>
      </div>
      <AttributionChecks storyId={storyId} nodeId={node.id} />
      {blocks === null ? (
        <p className={styles.empty}>Reading the dialogue…</p>
      ) : lines.length === 0 ? (
        <p className={styles.empty}>
          No dialogue in this scene yet. Quoted lines appear here; attribute one with{" "}
          <code>"text"&lt;Name&gt;</code> or <code>^</code>.
        </p>
      ) : (
        <div className={styles.thread}>
          {lines.map((b, i) => (
            <DialogueLine
              key={b.id}
              block={b}
              placed={placed[i]}
              unattributed={unattributed(b)}
              isPov={!!povName && b.speaker_name.toLowerCase() === povName.toLowerCase()}
              speaker={
                characters.find((c) => c.id === b.character_id) ??
                characters.find((c) => c.name.toLowerCase() === b.speaker_name.toLowerCase())
              }
              choices={choices}
              tagging={tagging}
              onTag={(name) => tagLine(b, name)}
              suggestion={
                unattributed(b)
                  ? suggestions.find(
                      (s) =>
                        !dismissed.has(s.id) &&
                        s.quote_content.trim().toLowerCase() === b.content.trim().toLowerCase(),
                    )
                  : undefined
              }
              onDismiss={(id) => setDismissed((prev) => new Set([...prev, id]))}
            />
          ))}
        </div>
      )}
      {autoTag && (
        <AutoTagDialoguePanel
          sceneId={node.id}
          storyId={storyId}
          characterNames={characters.map((c) => c.name)}
          onClose={() => setAutoTag(false)}
          onApplied={applyUpdated}
        />
      )}
    </section>
  );
}
