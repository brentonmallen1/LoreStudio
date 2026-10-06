import { useNavigate } from "react-router-dom";
import { slotVar } from "../../lib/colorSlots";
import { chapterStarts } from "../../lib/numbers/charts";
import type { Figures } from "../../lib/numbers/figures";
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
  now,
  then,
}: {
  storyId: string;
  now: Figures;
  then: Figures | null;
}) {
  const navigate = useNavigate();
  const { scenes, rotation, chapters } = now;
  const { rows, perScene } = rotation;
  if (rows.length < 2) return null;
  const byId = new Map(rows.map((r) => [r.character.id, r.character]));
  // Compared (doc 19): whose eyes each scene there then was seen through, and each one's count.
  const thenPov = new Map(then?.scenes.map((s, i) => [s.id, then.rotation.perScene[i]]) ?? []);
  const thenCount = new Map(then?.rotation.rows.map((r) => [r.character.id, r.scenes.length]) ?? []);
  const colourOf = (id: string | null | undefined) => {
    const c = id ? (byId.get(id) ?? then?.characters.find((x) => x.id === id)) : undefined;
    return c ? slotVar(c.color_slot) : "var(--color-surface-2)";
  };
  const was = (id: string, pov: string | null | undefined) =>
    then && thenPov.has(id) && (thenPov.get(id) ?? null) !== (pov ?? null)
      ? (thenPov.get(id) ?? null)
      : undefined;
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
            const before = was(s.id, perScene[i]);
            const name = (id: string | null) =>
              id
                ? (byId.get(id)?.name ?? then?.characters.find((x) => x.id === id)?.name ?? "someone")
                : "no one";
            const since = before !== undefined ? `; seen through ${name(before)} then` : "";
            const mark = {
              "data-tall": true,
              "data-chapter": starts.has(i) || undefined,
              "data-was": before !== undefined || undefined,
            };
            const thenStyle = { "--then": colourOf(before) } as React.CSSProperties;
            return c ? (
              <button
                key={s.id}
                type="button"
                className={`${styles.cell} ${styles.cellBtn}`}
                {...mark}
                style={{ ...thenStyle, background: slotVar(c.color_slot) }}
                title={`${s.title}: seen through ${c.name}${since}`}
                aria-label={`${s.title}, seen through ${c.name}${since}`}
                onClick={() => navigate(`/stories/${storyId}/write/${s.id}`)}
              />
            ) : (
              <span
                key={s.id}
                className={styles.cell}
                {...mark}
                style={thenStyle}
                title={`${s.title}: no point of view set${since}`}
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
              {then && (thenCount.get(r.character.id) ?? 0) !== r.scenes.length
                ? ` (was ${thenCount.get(r.character.id) ?? 0})`
                : ""}
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
