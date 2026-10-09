import { api } from "../../api/client";
import { POV_AREAS, pageLine } from "../../lib/lorebook/whoAreThey";
import { whoIsHere } from "../../lib/scene/glance";
import { useStoryStore } from "../../stores/storyStore";
import type { Story, StructureNode } from "../../types";
import SceneSettingsField from "../editor/panels/SceneSettingsField";
import SceneWhenField from "../editor/panels/SceneWhenField";
import styles from "./SceneSheet.module.css";

type Patch = Parameters<typeof api.updateNode>[1];

/**
 * The facts about a scene on its sheet (doc 24 D19): who is in it, and how their bodies and
 * minds show (doc 20 P7); whose eyes, in a story told through more than one; where; which
 * beat, and when.
 */
export default function SceneFacts({
  node,
  story,
  patch,
}: {
  node: StructureNode;
  story: Story;
  patch: (fields: Patch) => Promise<void>;
}) {
  const { characters, locations, sceneCast, beatSheets } = useStoryStore();
  const povId = node.pov_character_id ?? story.pov_character_id;
  const castIds = sceneCast?.scenes.find((s) => s.node_id === node.id)?.character_ids ?? [];
  const who = whoIsHere(povId, castIds, characters);
  const shows = who.flatMap((p) => {
    const c = characters.find((x) => x.id === p.id);
    const line = c ? (p.pov ? pageLine(c, POV_AREAS) : pageLine(c)) : "";
    return line ? [{ name: p.name, pov: p.pov, line }] : [];
  });
  const beatSheet = beatSheets.find((s) => s.id === story.beat_sheet_id) ?? null;
  const beat = beatSheet?.beats.find((b) => b.id === node.beat_id);
  const manyPov =
    story.narrative_perspective === "first_person" || story.narrative_perspective === "multiple_pov";

  return (
    <div className={styles.facts}>
      <div className={`${styles.box} ${styles.factGroup}`}>
        <div className={styles.fact}>
          <span className={styles.label}>Who</span>
          {who.length ? (
            <p className={styles.factText}>
              {who.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && " · "}
                  {p.name}
                  {p.pov && <span className={styles.muted}> POV</span>}
                </span>
              ))}
            </p>
          ) : (
            <p className={styles.muted}>No one found on the page yet.</p>
          )}
          {shows.map((s) => (
            <p key={s.name} className={styles.shows}>
              {s.pov ? `Seen through ${s.name}` : s.name} · {s.line}
            </p>
          ))}
        </div>
        {manyPov && (
          <label className={styles.fact}>
            <span className={styles.label}>Whose eyes</span>
            <select
              className={styles.select}
              value={node.pov_character_id ?? ""}
              onChange={(e) => void patch({ pov_character_id: e.target.value || null })}
            >
              <option value="">
                Story default ({characters.find((c) => c.id === story.pov_character_id)?.name ?? "none"})
              </option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className={`${styles.box} ${styles.factGroup}`}>
        <SceneSettingsField key={`where:${node.id}`} activeNode={node} locations={locations} />
      </div>

      {beatSheet && (
        <div className={`${styles.box} ${styles.factGroup}`}>
          <label className={styles.fact}>
            <span className={styles.label}>Beat</span>
            <select
              className={styles.select}
              value={node.beat_id ?? ""}
              onChange={(e) => void patch({ beat_id: e.target.value || null })}
            >
              <option value="">None</option>
              {beatSheet.beats.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.position_pct}% · {b.name}
                </option>
              ))}
            </select>
            {beat?.description && <span className={styles.hint}>{beat.description}</span>}
          </label>
        </div>
      )}

      <div className={`${styles.box} ${styles.factGroup}`}>
        <SceneWhenField key={`when:${node.id}`} activeNode={node} storyId={story.id} patch={patch} />
      </div>
    </div>
  );
}
