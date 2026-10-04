import { Link } from "react-router-dom";
import { slotVar } from "../../lib/colorSlots";
import { sectionPath } from "../../lib/routes";
import type { ComingInItem, Promises, ReaderItem } from "../../types/promises";
import styles from "./ReaderTable.module.css";

/**
 * What the reader knows, scene by scene (doc 18 C8): what they learn, what they are led to
 * believe, and what only they know. Clues and reveals fill it from the twists; the author's
 * own entries add the rest. A belief the story has overturned is struck through. In a book of
 * a series, the first row is what the reader comes in knowing from the books before (v1.5).
 */
export default function ReaderTable({
  storyId,
  data,
  ironyOnly,
}: {
  storyId: string;
  data: Promises;
  ironyOnly: boolean;
}) {
  const twists = new Map(data.twists.map((t) => [t.id, t]));
  const rows = ironyOnly ? data.reader.filter((r) => r.only.length > 0) : data.reader;
  const coming = data.coming_in;
  const comingAny =
    coming && (ironyOnly ? coming.only.length > 0 : Object.values(coming).some((l) => l.length));

  const earlier = (items: ComingInItem[], kind: "learns" | "believes" | "only") => (
    <div className={`${styles.cell} ${kind === "only" ? styles.onlyCell : ""}`}>
      {items.map((item, i) => (
        <p
          key={i}
          className={`${styles.item} ${item.overturned_at ? styles.over : ""} ${kind === "only" ? styles.only : ""}`}
        >
          <span className={styles.text}>{item.text}</span>{" "}
          <span className={styles.source}>
            {item.overturned_at ? `no longer, after ${item.overturned_at}` : `Book ${item.book + 1}`}
          </span>
        </p>
      ))}
    </div>
  );

  function source(item: ReaderItem) {
    const tw = item.twist_id ? twists.get(item.twist_id) : undefined;
    if (item.over) return <span className={styles.source}>no longer</span>;
    if (item.source === "you") return <span className={styles.source}>you added</span>;
    return (
      <span className={styles.source} style={{ "--lane": slotVar(tw?.color_slot) } as React.CSSProperties}>
        <span className={styles.diamond} aria-hidden />
        {item.source === "reveal" ? "reveal" : "clue"}
        {tw && (
          <>
            {" · "}
            <Link to={sectionPath(storyId, "promises", "twists", tw.id)} className={styles.twist}>
              {tw.name}
            </Link>
          </>
        )}
      </span>
    );
  }

  const cell = (items: ReaderItem[], kind: "learns" | "believes" | "only") => (
    <div className={`${styles.cell} ${kind === "only" ? styles.onlyCell : ""}`}>
      {items.map((item, i) => (
        <p
          key={i}
          className={`${styles.item} ${item.over ? styles.over : ""} ${kind === "only" ? styles.only : ""}`}
        >
          <span className={styles.text}>{item.text}</span> {source(item)}
        </p>
      ))}
    </div>
  );

  if (rows.length === 0 && !comingAny) {
    return (
      <p className={styles.empty}>
        {ironyOnly
          ? "Nothing only the reader knows yet. Dramatic irony is when the reader knows something a character does not: add it under Your entries."
          : "Nothing yet. Plant clues and choose where each twist is revealed, and what the reader knows fills in here; add what those do not say under Your entries."}
      </p>
    );
  }

  return (
    <div className={styles.table} role="table" aria-label="What the reader knows, scene by scene">
      <div className={`${styles.row} ${styles.head} ${ironyOnly ? styles.rowIrony : ""}`} role="row">
        <span role="columnheader">Scene</span>
        {!ironyOnly && <span role="columnheader">The reader learns</span>}
        {!ironyOnly && <span role="columnheader">…and is led to believe</span>}
        <span role="columnheader">Only the reader knows</span>
      </div>
      {coming && comingAny && (
        <div className={`${styles.row} ${styles.comingIn} ${ironyOnly ? styles.rowIrony : ""}`} role="row">
          <span className={styles.scene} role="cell">
            Coming in
            {data.series_id && (
              <Link to={`/series/${data.series_id}/story-so-far`} className={styles.twist}>
                The story so far
              </Link>
            )}
          </span>
          {!ironyOnly && earlier(coming.learned, "learns")}
          {!ironyOnly && earlier(coming.believes, "believes")}
          {earlier(coming.only, "only")}
        </div>
      )}
      {rows.map((r) => (
        <div key={r.node_id} className={`${styles.row} ${ironyOnly ? styles.rowIrony : ""}`} role="row">
          <Link to={`/stories/${storyId}/write/${r.node_id}`} className={styles.scene} role="cell">
            {data.scenes[r.index]?.title ?? "A scene"}
          </Link>
          {!ironyOnly && cell(r.learns, "learns")}
          {!ironyOnly && cell(r.believes, "believes")}
          {cell(r.only, "only")}
        </div>
      ))}
    </div>
  );
}
