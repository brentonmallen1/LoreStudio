import { Fragment } from "react";
import { Link, useNavigate } from "react-router-dom";
import { slotVar } from "../../lib/colorSlots";
import type { ChapterSpan, Lane } from "../../lib/numbers/charts";
import { LEGEND, ROLE_SHAPE } from "../../lib/promises/tapestry";
import { sectionPath } from "../../lib/routes";
import { roleLabel, STATUS_LABELS } from "../../lib/threads/roles";
import type { StructureNode } from "../../types";
import tapestry from "../promises/Tapestry.module.css";
import ChapterRow from "./SceneAxis";
import SectionHeading from "./SectionHeading";
import styles from "./Numbers.module.css";

/**
 * Where each thread runs and what each scene does to it (doc 13 P3, doc 18): the tapestry's
 * marks, in the pacing chart's columns. Twists and setups stay on the tapestry itself.
 */
export default function Threads({
  storyId,
  lanes,
  scenes,
  chapters,
}: {
  storyId: string;
  lanes: Lane[];
  scenes: StructureNode[];
  chapters: ChapterSpan[];
}) {
  const navigate = useNavigate();
  const used = new Set(lanes.flatMap((l) => l.marks.map((m) => ROLE_SHAPE[m.role] ?? "moves")));
  return (
    <section className={styles.section} aria-labelledby="numbers-threads">
      <SectionHeading section="threads" title="Threads" />
      <p className={styles.lede}>
        Where each thread runs, from the first scene it is in to the last, and what each of those scenes does
        to it. Twists and setups run beside the threads in{" "}
        <Link to={sectionPath(storyId, "promises", "tapestry")}>the tapestry</Link>.
      </p>
      <div className={styles.score} style={{ "--cols": scenes.length } as React.CSSProperties}>
        <ChapterRow chapters={chapters} />
        {lanes.map(({ thread, marks }) => {
          const name = thread.name;
          return (
            <Fragment key={thread.id}>
              <span className={styles.rowLabel} title={name}>
                {name}
              </span>
              <div
                className={styles.lane}
                style={{ "--lane": slotVar(thread.color_slot) } as React.CSSProperties}
              >
                {marks.length > 1 && (
                  <span
                    className={tapestry.span}
                    style={
                      {
                        "--from": marks[0].index,
                        "--to": marks[marks.length - 1].index,
                      } as React.CSSProperties
                    }
                    aria-hidden
                  />
                )}
                {marks.map((m) => {
                  const label = `${name}. ${scenes[m.index]?.title ?? "A scene"}: ${roleLabel(m.role)}${m.note ? `. ${m.note}` : ""}`;
                  return (
                    <button
                      key={m.nodeId}
                      type="button"
                      className={`${tapestry.mark} ${tapestry[ROLE_SHAPE[m.role] ?? "moves"]}`}
                      style={{ "--i": m.index } as React.CSSProperties}
                      title={label}
                      aria-label={label}
                      onClick={() => navigate(`/stories/${storyId}/write/${m.nodeId}`)}
                    />
                  );
                })}
              </div>
              <span className={styles.rowMeta}>{STATUS_LABELS[thread.status] ?? thread.status}</span>
            </Fragment>
          );
        })}
      </div>
      {used.size > 0 && (
        <ul className={styles.legend} aria-label="What the marks mean">
          {LEGEND.filter((k) => used.has(k.shape)).map((k) => (
            <li key={k.shape}>
              <span className={`${tapestry.key} ${tapestry[k.shape]}`} aria-hidden />
              {k.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
