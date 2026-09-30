import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { openScene, sceneTitle } from "../../lib/panel/openScene";
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
  const { activeStory, activeNode, upsertThread, setThreads } = useStoryStore();
  useReloadOnUndo(["plot_thread", "plot_thread_appearance"], () => {
    if (activeStory) api.listThreads(activeStory.id).then(setThreads);
  });
  const appearances = [...(thread.appearances ?? [])];

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
        <label className={styles.field}>
          <span className={styles.label}>Status</span>
          <select
            className={styles.select}
            value={thread.status}
            onChange={(e) => api.updateThread(thread.id, { status: e.target.value }).then(upsertThread)}
          >
            <option value="open">Open</option>
            <option value="developing">Developing</option>
            <option value="resolved">Resolved</option>
          </select>
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
                title={a.note || undefined}
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
