import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { sceneLeaves } from "../../lib/planning/methods";
import { addPlannedScene } from "../../lib/planning/plannedScene";
import { SceneRow } from "./SceneListStep";
import styles from "./Plan.module.css";

/**
 * One beat of a beat sheet: which scenes carry it, each with a line saying what happens.
 * A new scene is planned for the beat at the end of the story; an existing one can take
 * it over. The beat is the scene's beat_id, the same one the scene's notes show.
 */
export default function BeatStep({
  storyId,
  beatId,
  beatName,
}: {
  storyId: string;
  beatId: string;
  beatName: string;
}) {
  const navigate = useNavigate();
  const { structure, activeTemplate, patchNode, beatSheets, activeStory } = useStoryStore();
  const scenes = sceneLeaves(structure, activeTemplate);
  const carrying = scenes.filter((s) => s.beat_id === beatId);
  const others = scenes.filter((s) => s.beat_id !== beatId);
  const sheet = beatSheets.find((b) => b.id === activeStory?.beat_sheet_id);
  // The sheet this method walks (planning_method "beats:<id>"), for beat order.
  const walked = beatSheets.find((b) => `beats:${b.id}` === activeStory?.planning_method);
  const nameOf = (id: string | null) => sheet?.beats.find((b) => b.id === id)?.name;
  const [focusId, setFocusId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  /** Next to the scenes of the nearest earlier beat, else before the nearest later one. */
  function neighbour(): { after?: (typeof scenes)[number]; before?: (typeof scenes)[number] } | undefined {
    const beats = [...(walked?.beats ?? [])].sort((a, b) => a.position_pct - b.position_pct);
    const i = beats.findIndex((b) => b.id === beatId);
    for (let j = i - 1; j >= 0; j--) {
      const hit = scenes.filter((s) => s.beat_id === beats[j].id).at(-1);
      if (hit) return { after: hit };
    }
    for (let j = i + 1; j < beats.length; j++) {
      const hit = scenes.find((s) => s.beat_id === beats[j].id);
      if (hit) return { before: hit };
    }
    return undefined;
  }

  async function add() {
    setHint(null);
    const result = await addPlannedScene(storyId, { title: beatName, beat_id: beatId }, neighbour());
    if ("hint" in result) setHint(result.hint);
    else setFocusId(result.node.id);
  }

  async function assign(sceneId: string, beat: string | null) {
    const updated = await api.updateNode(sceneId, { beat_id: beat });
    patchNode(sceneId, { beat_id: updated.beat_id, updated_at: updated.updated_at });
  }

  return (
    <div className={styles.stepBody}>
      {carrying.length === 0 && <p className={styles.quiet}>No scene carries this beat yet.</p>}
      <ol className={styles.sceneList}>
        {carrying.map((scene) => (
          <li key={scene.id} className={styles.sceneItem}>
            <SceneRow
              scene={scene}
              number={scenes.indexOf(scene) + 1}
              autoFocus={scene.id === focusId}
              onFocused={() => setFocusId(null)}
              onOpen={() => navigate(`/stories/${storyId}/write?node=${scene.id}`)}
            />
            <button className={styles.linkBtn} onClick={() => assign(scene.id, null)}>
              Not this beat
            </button>
          </li>
        ))}
      </ol>
      <div className={styles.beatActions}>
        <button className={styles.addRow} onClick={add}>
          <Plus size={13} />
          Plan a scene for this beat
        </button>
        {others.length > 0 && (
          <select
            className={styles.input}
            value=""
            onChange={(e) => e.target.value && assign(e.target.value, beatId)}
            aria-label="Give this beat to a scene you have"
          >
            <option value="">…or give it to a scene you have</option>
            {others.map((s) => (
              <option key={s.id} value={s.id}>
                {scenes.indexOf(s) + 1}. {s.title}
                {s.beat_id && nameOf(s.beat_id) ? ` (now: ${nameOf(s.beat_id)})` : ""}
              </option>
            ))}
          </select>
        )}
      </div>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
