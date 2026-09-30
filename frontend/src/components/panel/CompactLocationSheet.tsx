import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { openScene, sceneTitle } from "../../lib/panel/openScene";
import { useStoryStore } from "../../stores/storyStore";
import type { Location } from "../../types";
import AutosaveTextarea from "./AutosaveTextarea";
import styles from "./Panel.module.css";

/** A place beside the prose: how it feels, why it matters, and the scenes set there. */
export default function CompactLocationSheet({ location }: { location: Location }) {
  const { activeStory, activeNode, sceneCast, upsertLocation, setLocations } = useStoryStore();
  useReloadOnUndo(["location"], () => {
    if (activeStory) api.listLocationsFlat(activeStory.id).then(setLocations);
  });
  const save = (key: keyof Location) => (value: string) =>
    api.updateLocation(location.id, { [key]: value }).then(upsertLocation);
  const scenes = (sceneCast?.scenes ?? []).filter((s) => s.location_ids.includes(location.id));

  return (
    <>
      <section className={styles.section}>
        <AutosaveTextarea
          key={`${location.id}:description`}
          label="Description"
          initial={location.description ?? ""}
          placeholder="What is there…"
          save={save("description")}
        />
        <AutosaveTextarea
          key={`${location.id}:atmosphere`}
          label="Atmosphere"
          initial={location.atmosphere ?? ""}
          placeholder="How it feels to be there…"
          save={save("atmosphere")}
        />
        <AutosaveTextarea
          key={`${location.id}:significance`}
          label="Significance"
          initial={location.significance ?? ""}
          placeholder="Why the story needs this place…"
          save={save("significance")}
        />
      </section>
      <section className={styles.section}>
        <h4 className={styles.heading}>Set here</h4>
        {scenes.length === 0 ? (
          <p className={styles.empty}>No scene is set here yet.</p>
        ) : (
          <div className={styles.chips}>
            {scenes.map((s) => (
              <button
                key={s.node_id}
                className={`${styles.chip} ${s.node_id === activeNode?.id ? styles.chipCurrent : ""}`}
                onClick={() => openScene(s.node_id)}
              >
                {sceneTitle(s.node_id)}
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
