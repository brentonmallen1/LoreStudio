import { useState } from "react";
import { organizeApi } from "../../api/organize";
import { canWrap, nextPartName } from "../../lib/outline/selection";
import { levelWord, shapeOf } from "../../lib/outline/tree";
import { reloadStructure } from "../../lib/story/loadStory";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import NameDialog from "../common/NameDialog";
import styles from "./Outline.module.css";

/**
 * The scenes chosen in the Outline List, and "Wrap in a chapter" (doc 29 D6): the shape's own
 * word for the level above scenes, a name to start from, and why not when it cannot be done.
 * One change ⌘Z takes back whole.
 */
export default function WrapBar({
  storyId,
  ids,
  onDone,
}: {
  storyId: string;
  ids: string[];
  onDone: () => void;
}) {
  const structure = useStoryStore((s) => s.structure);
  const shape = shapeOf(useStoryStore((s) => s.activeTemplate));
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const check = canWrap(structure, ids, shape);
  const n = ids.length;
  const scenes = `${n} ${levelWord(shape, shape.names.length - 1, n !== 1)}`;

  async function wrap(title: string) {
    if (!check.ok) return;
    setBusy(true);
    try {
      const made = await organizeApi.wrap(storyId, ids, title);
      await reloadStructure();
      setAsking(false);
      onDone();
      const rest = made[1]
        ? ` The ${check.level}'s later scenes went into “${made[1].title}”, so the order stays.`
        : "";
      toast.info(`“${made[0]?.title ?? title}” holds ${scenes} now.${rest}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Those scenes were not wrapped. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrapBar} role="region" aria-label="Chosen scenes">
      <span className={styles.wrapCount}>{scenes} chosen</span>
      {check.ok ? (
        <button type="button" className={styles.secondary} onClick={() => setAsking(true)}>
          Wrap in a {check.level}
        </button>
      ) : (
        <span className={styles.wrapWhy}>{check.refused}</span>
      )}
      <button type="button" className={styles.secondary} onClick={onDone}>
        Clear
      </button>
      {asking && check.ok && (
        <NameDialog
          title={`Wrap ${scenes} in a ${check.level}`}
          label={`The ${check.level}'s name`}
          initial={nextPartName(structure, shape)}
          confirm="Wrap them"
          busy={busy}
          onConfirm={(title) => void wrap(title)}
          onCancel={() => setAsking(false)}
        >
          The new {check.level} takes their place in the Outline, holding them in the same order.
          {check.middle && check.parent
            ? ` They come from the middle of “${check.parent.title || "Untitled"}”, so its later scenes go into a ${check.level} of their own after it, and the order stays as it is.`
            : ""}
        </NameDialog>
      )}
    </div>
  );
}
