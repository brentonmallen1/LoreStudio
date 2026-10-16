import { useState } from "react";
import { Link } from "react-router-dom";
import { PenLine } from "lucide-react";
import { structureApi } from "../../api/structure";
import { EMPTY } from "../../lib/emptyStates";
import { firstScene, leafDepth, levelWord, shapeOf } from "../../lib/outline/tree";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import type { WorkingStyle } from "../../types";
import EmptyState from "../common/EmptyState";
import OutlineMark from "./OutlineMark";
import { useOutlineActions } from "./useOutlineActions";
import styles from "./Outline.module.css";

/**
 * The Outline with nothing in it yet, by how the writer works (doc 29 D2): a planner gets a
 * line ready to type into, with the keys explained; a discovery writer is told it fills in
 * as they write, and the way to the first scene. `onStarted` gets the first line's scene.
 */
export default function OutlineEmpty({
  storyId,
  style,
  onStarted,
}: {
  storyId: string;
  style: WorkingStyle;
  onStarted: (sceneId: string) => void;
}) {
  if (style === "discover")
    return (
      <div className={styles.empty}>
        <EmptyState
          copy={EMPTY.outlineDiscover}
          action={{ label: "Write the first scene", icon: PenLine, to: `/stories/${storyId}/write` }}
        />
      </div>
    );
  return <FirstLine storyId={storyId} onStarted={onStarted} />;
}

function FirstLine({ storyId, onStarted }: { storyId: string; onStarted: (sceneId: string) => void }) {
  const template = useStoryStore((s) => s.activeTemplate);
  const shape = shapeOf(template);
  const { save, reload } = useOutlineActions(storyId);
  const [busy, setBusy] = useState(false);
  const leaf = leafDepth(shape);
  const holder = leaf > 0 ? levelWord(shape, leaf - 1) : null;

  async function start(title: string) {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      let id = firstScene(useStoryStore.getState().structure, shape)?.id;
      if (!id) {
        id = (await structureApi.start(storyId)).start_node_id;
        await reload();
      }
      // Started first, so the list that replaces this has the next line ready to type.
      onStarted(id);
      await save(id, { title: title.trim() });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The Outline could not be started.");
      setBusy(false);
    }
  }

  return (
    <section className={styles.empty} aria-label="Start with what happens first">
      <div className={styles.emptyBox}>
        <h2 className={styles.emptyTitle}>Start with what happens first</h2>
        <div className={styles.firstLine}>
          <OutlineMark status="planned" />
          <input
            autoFocus
            className={styles.firstInput}
            placeholder="A line for each thing that happens…"
            aria-label="What happens first"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void start(e.currentTarget.value);
              }
            }}
          />
        </div>
        <ul className={styles.emptyKeys}>
          <li>
            <strong>Enter</strong> adds the next line.
          </li>
          {holder && (
            <li>
              <strong>Shift+Tab</strong> makes a line a {holder} that holds the lines after it;{" "}
              <strong>Tab</strong> tucks it back in.
            </li>
          )}
          <li>Each line becomes a {levelWord(shape, leaf)} you can write when you're ready.</li>
        </ul>
        <div className={styles.emptyMore}>
          <span className={styles.emptyAsk}>Not sure what happens yet?</span>
          <div className={styles.emptyButtons}>
            <Link to={`/stories/${storyId}/plan`} className={styles.secondary}>
              Plan with questions
            </Link>
            <Link to={`/stories/${storyId}/plan`} className={styles.secondary}>
              Start from a classic pattern
            </Link>
          </div>
        </div>
        <div className={styles.emptyExample}>
          <span className={styles.exampleLabel}>For example, from The Last Lighthouse</span>
          <span>
            Eleanor tends the light as a storm comes in · A stranger arrives and asks to stay · The stranger
            asks to read the logbooks…
          </span>
        </div>
      </div>
    </section>
  );
}
