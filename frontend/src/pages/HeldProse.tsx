import { useState } from "react";
import { structureApi } from "../api/structure";
import { SHORTCUTS, formatCombo } from "../lib/keyboard/shortcuts";
import { reloadStructure } from "../lib/story/loadStory";
import type { StructureNode } from "../types";
import styles from "./ContainerNodePage.module.css";

/**
 * A chapter's (or an act's) own words, outside any scene: an older import left them there. The
 * strip, the export and Numbers count only scenes, so they go missing; one click gives them a
 * scene of their own, named for this chapter.
 */
export default function HeldProse({ node, levelName }: { node: StructureNode; levelName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const words = node.word_count ?? 0;
  if (!words) return null;

  async function give() {
    setBusy(true);
    setError(null);
    try {
      await structureApi.giveScene(node.id);
      await reloadStructure();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.held} role="note">
      <span>
        This {levelName.toLowerCase()} holds {words.toLocaleString()} {words === 1 ? "word" : "words"} outside
        any scene. The strip, the export and Numbers count only scenes.
      </span>
      <button
        className={styles.primary}
        onClick={give}
        disabled={busy}
        title={`${formatCombo(SHORTCUTS.undo.combo)} takes it back`}
      >
        Give them a scene
      </button>
      {error && <span className={styles.heldError}>{error}</span>}
    </div>
  );
}
