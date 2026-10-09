import { colourFor, stopShape, type Stop } from "../../lib/strip/stripModel";
import type { TreeMarks } from "../../lib/strip/treeMarks";
import styles from "./Strip.module.css";

/** A scene's mark: its state as a shape (planned dashed, draft hollow, revised filled, final
 *  ringed), coloured by what the strip is colouring by. The same dot the line draws. */
export function StopMark({ stop, marks }: { stop: Stop; marks: TreeMarks }) {
  const shape = stopShape(stop.status);
  const swatch = colourFor(marks.mode, stop, marks.ctx)[0];
  return (
    <span className={styles.markSlot} aria-hidden title={swatch?.label}>
      <span
        className={[
          styles.dot,
          shape === "hollow" ? styles.dotHollow : "",
          shape === "dashed" ? styles.dotDashed : "",
          shape === "ringed" ? styles.dotRinged : "",
        ].join(" ")}
        style={{ "--stop-color": swatch?.color } as React.CSSProperties}
      />
    </span>
  );
}

/** A folded chapter's scenes as a row of bars, so folding keeps the colour pattern. */
export function ChapterBars({
  stops,
  marks,
  indent,
  open,
}: {
  stops: Stop[];
  marks: TreeMarks;
  indent: number;
  open: (e: React.MouseEvent, id: string) => void;
}) {
  return (
    <div className={styles.bars} style={{ paddingLeft: indent }}>
      {stops.map((s) => (
        <button
          key={s.node.id}
          className={`${styles.bar} ${s.planned ? styles.barPlanned : ""} ${s.index === marks.currentIndex ? styles.barCurrent : ""}`}
          style={
            {
              width: s.planned ? 22 : Math.min(48, 12 + Math.round(s.words / 20)),
              "--stop-color": colourFor(marks.mode, s, marks.ctx)[0]?.color,
            } as React.CSSProperties
          }
          onClick={(e) => open(e, s.node.id)}
          title={s.node.title}
          aria-label={s.node.title}
        />
      ))}
    </div>
  );
}
