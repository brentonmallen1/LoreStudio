import { useState } from "react";
import { Maximize2, Users } from "lucide-react";
import { Modal } from "../common";
import { slotVar } from "../../lib/colorSlots";
import { chapterStarts, type CastRow, type ChapterSpan } from "../../lib/numbers/charts";
import type { StructureNode } from "../../types";
import ChapterRow, { SceneTicks } from "./SceneAxis";
import SectionHeading from "./SectionHeading";
import styles from "./Numbers.module.css";

/** Rows on the page; the rest are a click away, in the full grid. */
const ROWS = 6;

/**
 * Who is on the page, scene by scene (doc 13 P3): a grid, a row per character and a column per
 * scene in the pacing chart's columns, a cell filled where they are in the scene and filled
 * fully where it is seen through them. The page shows the busiest few; the full grid, with
 * every character and every scene named, opens in a modal.
 */
export default function Cast({
  cast,
  scenes,
  chapters,
}: {
  cast: CastRow[];
  scenes: StructureNode[];
  chapters: ChapterSpan[];
}) {
  const [open, setOpen] = useState(false);
  const onPage = cast.filter((r) => r.count > 0);
  const offPage = cast.filter((r) => r.count === 0);
  const shown = onPage.slice(0, ROWS);
  const hidden = onPage.length - shown.length;
  // With no point of view set anywhere there is only one level to draw, so it is drawn full.
  const hasPov = cast.some((r) => r.seenThrough.some(Boolean));
  return (
    <section className={styles.section} aria-labelledby="numbers-cast">
      <SectionHeading section="cast" title="Who is on the page" />
      <p className={styles.lede}>
        A row per character, a column per scene: a cell is filled where they are in the scene (named in the
        prose or placed there by hand), and filled fully where the scene is seen through them.
      </p>
      <Grid rows={shown} scenes={scenes} chapters={chapters} hasPov={hasPov} />
      <div className={styles.legend}>
        {hasPov ? (
          <>
            <span>
              <i className={styles.cellKey} data-level="pov" />
              seen through them
            </span>
            <span>
              <i className={styles.cellKey} data-level="present" />
              on the page
            </span>
          </>
        ) : (
          <span>
            <i className={styles.cellKey} data-level="pov" />
            in the scene (no point of view is set, on the book or a scene)
          </span>
        )}
        <span>
          <i className={styles.cellKey} />
          not in the scene
        </span>
      </div>
      <p className={styles.lede}>
        {hidden > 0 && `${hidden} more ${hidden === 1 ? "character is" : "characters are"} on the page. `}
        {offPage.length > 0 && `Not on the page yet: ${offPage.map((r) => r.character.name).join(", ")}. `}
        <button type="button" className={styles.link} onClick={() => setOpen(true)}>
          <Maximize2 size={12} aria-hidden /> Open the full grid
        </button>
      </p>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Who is on the page"
        icon={<Users size={15} />}
        size="xl"
      >
        <div className={styles.scrollX}>
          <Grid rows={cast} scenes={scenes} chapters={chapters} hasPov={hasPov} full />
        </div>
      </Modal>
    </section>
  );
}

function Grid({
  rows,
  scenes,
  chapters,
  hasPov,
  full = false,
}: {
  rows: CastRow[];
  scenes: StructureNode[];
  chapters: ChapterSpan[];
  hasPov: boolean;
  full?: boolean;
}) {
  const starts = chapterStarts(chapters);
  return (
    <div
      className={styles.score}
      data-dense
      data-full={full || undefined}
      style={{ "--cols": scenes.length } as React.CSSProperties}
    >
      <ChapterRow chapters={chapters} />
      {rows.map((r) => (
        <CastLine key={r.character.id} row={r} scenes={scenes} hasPov={hasPov} starts={starts} />
      ))}
      {full ? <SceneNames scenes={scenes} /> : <SceneTicks count={scenes.length} />}
    </div>
  );
}

function CastLine({
  row,
  scenes,
  hasPov,
  starts,
}: {
  row: CastRow;
  scenes: StructureNode[];
  hasPov: boolean;
  /** Columns that open a chapter: their cells carry the chapter rule. */
  starts: Set<number>;
}) {
  const { character, present, seenThrough, count, quiet, milestones } = row;
  const arc = milestones.total ? ` · arc ${milestones.done}/${milestones.total}` : "";
  const pov = seenThrough.filter(Boolean).length;
  const what = (i: number) =>
    seenThrough[i]
      ? `seen through ${character.name}`
      : present[i]
        ? `${character.name} is on the page`
        : `${character.name} is not in it`;
  return (
    <>
      <span className={styles.rowLabel} title={character.name}>
        {character.name}
      </span>
      <div
        className={styles.cols}
        role="img"
        aria-label={`${character.name}: in ${count} of ${scenes.length} scenes, ${pov} seen through them`}
        style={{ "--who": slotVar(character.color_slot) } as React.CSSProperties}
      >
        {present.map((p, i) => (
          <span
            key={scenes[i]?.id ?? i}
            className={styles.cell}
            data-chapter={starts.has(i) || undefined}
            data-level={seenThrough[i] || (p && !hasPov) ? "pov" : p ? "present" : undefined}
            title={`${scenes[i]?.title ?? "A scene"}: ${what(i)}`}
          />
        ))}
      </div>
      <span className={styles.rowMeta} data-tone={quiet ? "warning" : undefined}>
        {quiet ? "quiet lately · " : ""}
        {`${count} scene${count === 1 ? "" : "s"}${arc}`}
      </span>
    </>
  );
}

/** The full grid's axis: every scene by name, read upward, so a cell can be traced to its scene. */
function SceneNames({ scenes }: { scenes: StructureNode[] }) {
  return (
    <>
      <span className={styles.axisLabel}>Scene</span>
      <div className={`${styles.cols} ${styles.sceneNames}`}>
        {scenes.map((s, i) => (
          <span key={s.id} title={s.title}>
            {i + 1} {s.title}
          </span>
        ))}
      </div>
      <span />
    </>
  );
}
