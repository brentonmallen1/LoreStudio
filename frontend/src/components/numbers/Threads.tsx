import { Fragment } from "react";
import { Link, useNavigate } from "react-router-dom";
import { slotVar } from "../../lib/colorSlots";
import { marksThen } from "../../lib/numbers/compare";
import type { Figures } from "../../lib/numbers/figures";
import { LEGEND, ROLE_SHAPE } from "../../lib/promises/tapestry";
import { sectionPath } from "../../lib/routes";
import { roleLabel, STATUS_LABELS } from "../../lib/threads/roles";
import type { ThreadRole, ThreadStatus } from "../../types";
import tapestry from "../promises/Tapestry.module.css";
import ChapterRow from "./SceneAxis";
import SectionHeading from "./SectionHeading";
import styles from "./Numbers.module.css";

const statusLabel = (s: string) => STATUS_LABELS[s as ThreadStatus] ?? s;

/**
 * Where each thread runs and what each scene does to it (doc 13 P3, doc 18): the tapestry's
 * marks, in the pacing chart's columns. Twists and setups stay on the tapestry itself.
 * Compared (doc 19), a mark new since then is ringed and one gone since then is drawn faint.
 */
export default function Threads({
  storyId,
  now,
  then,
}: {
  storyId: string;
  now: Figures;
  then: Figures | null;
}) {
  const navigate = useNavigate();
  const { lanes, scenes, chapters } = now;
  const before = then ? marksThen(then) : null;
  const statusThen = new Map(then?.threads.map((t) => [t.id, t.status]) ?? []);
  const at = new Map(scenes.map((s, i) => [s.id, i]));
  const used = new Set(lanes.flatMap((l) => l.marks.map((m) => ROLE_SHAPE[m.role] ?? "moves")));
  const title = (i: number) => scenes[i]?.title ?? "A scene";

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
          const had = before?.get(thread.id);
          const keys = new Set(marks.map((m) => `${m.nodeId}:${m.role}`));
          // Marks there then and gone now, where their scene still is.
          const gone = [...(had ?? [])]
            .filter((k) => !keys.has(k))
            .map((k) => {
              const [nodeId, role] = k.split(":");
              return { nodeId, role: role as ThreadRole, index: at.get(nodeId) };
            })
            .filter((g): g is { nodeId: string; role: ThreadRole; index: number } => g.index !== undefined);
          const was = statusThen.get(thread.id);
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
                {gone.map((g) => (
                  <span
                    key={`gone-${g.nodeId}-${g.role}`}
                    className={`${tapestry.mark} ${tapestry[ROLE_SHAPE[g.role] ?? "moves"]} ${styles.markGone}`}
                    style={{ "--i": g.index } as React.CSSProperties}
                    title={`${name}. ${title(g.index)}: ${roleLabel(g.role)}, then; not now`}
                  />
                ))}
                {marks.map((m) => {
                  const isNew = had !== undefined && !had.has(`${m.nodeId}:${m.role}`);
                  const label = `${name}. ${title(m.index)}: ${roleLabel(m.role)}${m.note ? `. ${m.note}` : ""}${isNew ? " (new since then)" : ""}`;
                  return (
                    <button
                      key={m.nodeId}
                      type="button"
                      className={`${tapestry.mark} ${tapestry[ROLE_SHAPE[m.role] ?? "moves"]}`}
                      data-new={isNew || undefined}
                      style={{ "--i": m.index } as React.CSSProperties}
                      title={label}
                      aria-label={label}
                      onClick={() => navigate(`/stories/${storyId}/write/${m.nodeId}`)}
                    />
                  );
                })}
              </div>
              <span className={styles.rowMeta}>
                {statusLabel(thread.status)}
                {/* A status the earlier reading did not record says nothing about a change. */}
                {then && !statusThen.has(thread.id) && " · new"}
                {then && was && was !== thread.status && ` · was ${statusLabel(was)}`}
              </span>
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
          {then && (
            <>
              <li>
                <i className={styles.newKey} />
                new since then
              </li>
              <li>
                <span className={`${tapestry.key} ${tapestry.moves} ${styles.markGone}`} aria-hidden />
                there then, not now
              </li>
            </>
          )}
        </ul>
      )}
    </section>
  );
}
