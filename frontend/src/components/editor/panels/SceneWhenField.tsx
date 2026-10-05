import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client";
import { useReloadOnUndo } from "../../../hooks/useUndoRedo";
import type { Era, StructureNode } from "../../../types";
import styles from "../SceneEditor.module.css";

/**
 * When a scene happens (series v2): a date in the story's own words, and the era it falls
 * in. The Plan's Timeline lays the scenes out by them, and a series that changes era from
 * book to book checks a scene's era against its book's.
 */
export default function SceneWhenField({
  activeNode,
  storyId,
  patch,
}: {
  activeNode: StructureNode;
  storyId: string;
  patch: (fields: { in_world_date?: string; era_id?: string | null }) => Promise<void>;
}) {
  const [date, setDate] = useState(activeNode.in_world_date ?? "");
  const [eras, setEras] = useState<Era[]>([]);
  useEffect(() => {
    api
      .listEras(storyId)
      .then(setEras)
      .catch(() => {});
  }, [storyId]);
  useReloadOnUndo(["era"], () => api.listEras(storyId).then(setEras));

  return (
    <div className={styles.overviewField}>
      <label className={styles.overviewLabel} htmlFor="scene-when-date">
        When
      </label>
      <input
        id="scene-when-date"
        className={styles.overviewSelect}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        onBlur={() => date !== (activeNode.in_world_date ?? "") && patch({ in_world_date: date })}
        placeholder="November 1962, the third winter, the morning after…"
      />
      {eras.length > 0 ? (
        <select
          aria-label="Era"
          className={styles.overviewSelect}
          value={activeNode.era_id ?? ""}
          onChange={(e) => patch({ era_id: e.target.value || null })}
        >
          <option value="">No era</option>
          {eras.map((era) => (
            <option key={era.id} value={era.id}>
              {era.name}
            </option>
          ))}
        </select>
      ) : (
        <p className={styles.overviewHint}>
          Eras live in the Lorebook's <Link to={`/stories/${storyId}/lorebook/history`}>History</Link>; once
          there is one, a scene can be placed in it.
        </p>
      )}
      <p className={styles.overviewHint}>
        The Plan's <Link to={`/stories/${storyId}/plan?view=timeline`}>Timeline</Link> lays scenes out in the
        order they happen.
      </p>
    </div>
  );
}
