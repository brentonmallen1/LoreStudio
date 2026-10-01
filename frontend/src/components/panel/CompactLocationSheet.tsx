import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { openScene, sceneTitle } from "../../lib/panel/openScene";
import { useStoryStore } from "../../stores/storyStore";
import type { Location } from "../../types";
import { KINDS } from "../../lib/lorebook/kinds";
import FieldList from "../lorebook/FieldList";

import SlotPicker from "../common/SlotPicker";
import { Link } from "react-router-dom";
import styles from "./Panel.module.css";

const COMPACT_FIELDS = KINDS.location.fields.filter((f) => f.compact);

/** A place beside the prose: how it feels, why it matters, and the scenes set there. */
export default function CompactLocationSheet({ location }: { location: Location }) {
  const { activeStory, activeNode, sceneCast, upsertLocation, setLocations } = useStoryStore();
  useReloadOnUndo(["location"], () => {
    if (activeStory) api.listLocationsFlat(activeStory.id).then(setLocations);
  });
  const scenes = (sceneCast?.scenes ?? []).filter((s) => s.location_ids.includes(location.id));

  return (
    <>
      {location.is_stub && activeStory && (
        <p className={styles.empty}>
          Found in your prose ·{" "}
          <Link to={`/stories/${activeStory.id}/proposals?kind=place`}>review in Proposals</Link>
        </p>
      )}
      <section className={styles.section}>
        <SlotPicker
          size="sm"
          value={location.color_slot}
          onChange={(slot) => api.updateLocation(location.id, { color_slot: slot }).then(upsertLocation)}
        />
        <FieldList
          entityKey={location.id}
          fields={COMPACT_FIELDS}
          values={location as unknown as Record<string, unknown>}
          save={(key, value) =>
            api
              .updateLocation(location.id, { [key]: value, ...(location.is_stub ? { is_stub: false } : {}) })
              .then(upsertLocation)
          }
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
