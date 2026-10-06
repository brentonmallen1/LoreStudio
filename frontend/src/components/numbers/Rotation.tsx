import { useNavigate } from "react-router-dom";
import { slotVar } from "../../lib/colorSlots";
import { chapterStarts, type ChapterSpan } from "../../lib/numbers/charts";
import type { PovRotation } from "../../lib/numbers/pov";
import type { StructureNode } from "../../types";
import ChapterRow from "./SceneAxis";
import SectionHeading from "./SectionHeading";
import styles from "./Numbers.module.css";

/**
 * Whose eyes, scene by scene (series v2): one strip, each scene in the colour of the character
 * it is seen through, so the rotation reads across in the pacing chart's columns and a voice
 * gone quiet shows as a stretch without its colour. Only drawn when the book has more than one.
 */
export default function Rotation({
  storyId,
  scenes,
  rotation,
  chapters,
}: {
  storyId: string;
  scenes: StructureNode[];
  rotation: PovRotation;
  chapters: ChapterSpan[];
}) {
  const navigate = useNavigate();
  const { rows, perScene } = rotation;
  if (rows.length < 2) return null;
  const byId = new Map(rows.map((r) => [r.character.id, r.character]));
  const overdue = rows.filter((r) => r.overdue);
  const starts = chapterStarts(chapters);
  return (
    <section className={styles.section} aria-labelledby="numbers-pov">
      <SectionHeading section="pov" title="Whose eyes" />
      <p className={styles.lede}>
        Each scene in the colour of the character it is seen through: the scene&rsquo;s own point of view, or
        the book&rsquo;s when it has none. Planned scenes count. Open a square for its scene.
      </p>
      <div className={styles.score} style={{ "--cols": scenes.length } as React.CSSProperties}>
        <ChapterRow chapters={chapters} />
        <span className={styles.axisLabel}>Seen through</span>
        <div className={styles.cols} role="group" aria-label="Whose eyes each scene is seen through">
          {scenes.map((s, i) => {
            const c = byId.get(perScene[i] ?? "");
            return c ? (
              <button
                key={s.id}
                type="button"
                className={`${styles.cell} ${styles.cellBtn}`}
                data-tall
                data-chapter={starts.has(i) || undefined}
                style={{ background: slotVar(c.color_slot) }}
                title={`${s.title}: seen through ${c.name}`}
                aria-label={`${s.title}, seen through ${c.name}`}
                onClick={() => navigate(`/stories/${storyId}/write/${s.id}`)}
              />
            ) : (
              <span
                key={s.id}
                className={styles.cell}
                data-tall
                data-chapter={starts.has(i) || undefined}
                title={`${s.title}: no point of view set`}
              />
            );
          })}
        </div>
        <span />
      </div>
      <div className={styles.legend}>
        {rows.map((r) => (
          <span key={r.character.id}>
            <i className={styles.swatch} style={{ background: slotVar(r.character.color_slot) }} />
            {r.character.name}
            <span className={styles.muted}>
              {r.scenes.length} scene{r.scenes.length === 1 ? "" : "s"}
            </span>
          </span>
        ))}
      </div>
      {overdue.length > 0 && (
        <p className={styles.lede}>
          {overdue
            .map((r) => {
              const last = scenes[r.scenes[r.scenes.length - 1]];
              return `${r.character.name} hasn't had a scene in ${r.since} (since “${last?.title ?? "the last"}”).`;
            })
            .join(" ")}
        </p>
      )}
    </section>
  );
}
