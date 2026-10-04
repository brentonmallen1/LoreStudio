import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { openScene, sceneTitle } from "../../lib/panel/openScene";
import { roleLabel, STATUS_LABELS, statusLine } from "../../lib/threads/roles";
import { useStoryStore } from "../../stores/storyStore";
import type { PlotThread } from "../../types";
import AutosaveTextarea from "./AutosaveTextarea";
import SlotPicker from "../common/SlotPicker";
import styles from "./Panel.module.css";

const MICE: Record<string, string> = {
  milieu: "Milieu · a place to enter and leave",
  idea: "Idea · a question to answer",
  character: "Character · a change to make",
  event: "Event · a disruption to set right",
};

/** A plot thread beside the prose: what it is, where it stands, and the scenes it runs through. */
export default function CompactThreadSheet({ thread }: { thread: PlotThread }) {
  const { activeStory, activeNode, upsertThread, setThreads, sceneCast } = useStoryStore();
  useReloadOnUndo(["plot_thread", "plot_thread_appearance"], () => {
    if (activeStory) api.listThreads(activeStory.id).then(setThreads);
  });
  // In reading order, as the strip and the Lorebook sheet list them (doc 18: it was raw order).
  const order = new Map((sceneCast?.scenes ?? []).map((s, i) => [s.node_id, i]));
  const appearances = [...(thread.appearances ?? [])].sort(
    (a, b) => (order.get(a.node_id) ?? Infinity) - (order.get(b.node_id) ?? Infinity),
  );

  return (
    <>
      <section className={styles.section}>
        <SlotPicker
          size="sm"
          value={thread.color_slot}
          onChange={(slot) => api.updateThread(thread.id, { color_slot: slot }).then(upsertThread)}
        />
        <AutosaveTextarea
          key={`${thread.id}:description`}
          label="What it is"
          initial={thread.description ?? ""}
          placeholder="The question this thread asks, or the change it makes…"
          save={(value) => api.updateThread(thread.id, { description: value }).then(upsertThread)}
        />
        {/* Status follows from the scenes (doc 18 C1); only setting it aside is a choice. */}
        <p className={styles.sub}>{statusLine(thread, (id) => sceneTitle(id))}</p>
        <label className={styles.field}>
          <input
            type="checkbox"
            checked={thread.set_aside}
            onChange={(e) => api.updateThread(thread.id, { set_aside: e.target.checked }).then(upsertThread)}
          />
          <span className={styles.label}>{STATUS_LABELS.set_aside}</span>
        </label>
        {thread.mice_type && <p className={styles.sub}>{MICE[thread.mice_type] ?? thread.mice_type}</p>}
      </section>
      <section className={styles.section}>
        <h4 className={styles.heading}>Runs through</h4>
        {appearances.length === 0 ? (
          <p className={styles.empty}>Not placed in any scene yet.</p>
        ) : (
          <div className={styles.chips}>
            {appearances.map((a) => (
              <button
                key={a.id}
                className={`${styles.chip} ${a.node_id === activeNode?.id ? styles.chipCurrent : ""}`}
                onClick={() => openScene(a.node_id)}
                title={[roleLabel(a.role), a.note].filter(Boolean).join(": ")}
              >
                {sceneTitle(a.node_id)}
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
