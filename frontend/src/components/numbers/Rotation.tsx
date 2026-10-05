import { useNavigate } from "react-router-dom";
import { slotVar } from "../../lib/colorSlots";
import type { PovRotation } from "../../lib/numbers/pov";
import type { StructureNode } from "../../types";
import styles from "./Numbers.module.css";

/**
 * Whose eyes, scene by scene (series v2): a line per point-of-view character, a square for
 * each scene seen through them, so the rotation reads across and a voice gone quiet shows.
 * Only drawn when the book has more than one viewpoint.
 */
export default function Rotation({
  storyId,
  scenes,
  rotation,
}: {
  storyId: string;
  scenes: StructureNode[];
  rotation: PovRotation;
}) {
  const navigate = useNavigate();
  const { rows } = rotation;
  if (rows.length < 2) return null;
  const overdue = rows.filter((r) => r.overdue);
  return (
    <section className={styles.section} aria-labelledby="numbers-pov">
      <h2 className={styles.heading} id="numbers-pov">
        Whose eyes
      </h2>
      <p className={styles.lede}>
        A square for every scene seen through each point-of-view character: a scene&rsquo;s own, or the
        book&rsquo;s when it has none. Planned scenes count. Open a square for its scene.
      </p>
      <div className={styles.score}>
        {rows.map((r) => (
          <PovLine
            key={r.character.id}
            name={r.character.name}
            color={slotVar(r.character.color_slot)}
            scenes={scenes}
            at={new Set(r.scenes)}
            meta={`${r.scenes.length} scene${r.scenes.length === 1 ? "" : "s"}`}
            quiet={r.overdue}
            onOpen={(id) => navigate(`/stories/${storyId}/write/${id}`)}
          />
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

function PovLine({
  name,
  color,
  scenes,
  at,
  meta,
  quiet,
  onOpen,
}: {
  name: string;
  color: string;
  scenes: StructureNode[];
  at: Set<number>;
  meta: string;
  quiet: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <span className={styles.rowLabel} title={name}>
        {name}
      </span>
      <div className={styles.cells} role="group" aria-label={`Scenes seen through ${name}`}>
        {scenes.map((s, i) =>
          at.has(i) ? (
            <button
              key={s.id}
              type="button"
              className={`${styles.cell} ${styles.cellBtn}`}
              style={{ background: color }}
              title={s.title}
              aria-label={`${s.title}, seen through ${name}`}
              onClick={() => onOpen(s.id)}
            />
          ) : (
            <span key={s.id} className={styles.cell} />
          ),
        )}
      </div>
      <span className={styles.rowMeta} data-tone={quiet ? "warning" : undefined}>
        {quiet ? "away a while · " : ""}
        {meta}
      </span>
    </>
  );
}
