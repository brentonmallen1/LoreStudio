import { useNavigate } from "react-router-dom";
import { sectionPath } from "../../lib/routes";
import { LEGEND, tapestryLanes, type Lane } from "../../lib/promises/tapestry";
import type { Promises } from "../../types/promises";
import styles from "./Tapestry.module.css";

/**
 * The tapestry (doc 18 C4): every promise across the book in reading order. A row per thread,
 * twist and setup; a column per scene. Each mark is a scene doing something to that promise,
 * and opens the scene; each name opens its sheet.
 */
export default function Tapestry({ storyId, data }: { storyId: string; data: Promises }) {
  const navigate = useNavigate();
  const groups = tapestryLanes(data).filter((g) => g.lanes.length > 0);
  const n = Math.max(data.scenes.length, 1);

  function openLane(lane: Lane) {
    if (lane.kind === "setup") navigate(sectionPath(storyId, "promises", "setups"));
    else navigate(sectionPath(storyId, "promises", lane.kind === "thread" ? "threads" : "twists", lane.id));
  }

  return (
    <section className={styles.tapestry} aria-label="The tapestry">
      <div className={styles.scroll}>
        <div className={styles.grid} style={{ "--cols": n } as React.CSSProperties}>
          {data.chapters.length > 0 && (
            <div className={styles.row}>
              <span className={styles.name} />
              <div className={styles.track}>
                {data.chapters.map((c) => (
                  <span
                    key={c.id}
                    className={styles.chapter}
                    style={{ "--first": c.first, "--count": c.count } as React.CSSProperties}
                    title={c.title}
                  >
                    {c.title}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className={`${styles.row} ${styles.sceneRow}`}>
            <span className={styles.name} />
            <div className={styles.track}>
              {data.scenes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`${styles.scene} ${s.written ? "" : styles.planned}`}
                  style={{ "--i": s.index } as React.CSSProperties}
                  title={s.written ? s.title : `${s.title} (not written yet)`}
                  onClick={() => navigate(`/stories/${storyId}/write/${s.id}`)}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>
          {groups.map((g) => (
            <div key={g.id} role="group" aria-label={g.label} className={styles.group}>
              <span className={styles.groupLabel}>{g.label}</span>
              {g.lanes.map((lane) => (
                <LaneRow
                  key={lane.id}
                  lane={lane}
                  cols={n}
                  onName={() => openLane(lane)}
                  onMark={(id) => navigate(`/stories/${storyId}/write/${id}`)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <ul className={styles.legend} aria-label="What the marks mean">
        {LEGEND.map((k) => (
          <li key={k.shape}>
            <span className={`${styles.key} ${styles[k.shape]}`} aria-hidden />
            {k.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function LaneRow({
  lane,
  cols,
  onName,
  onMark,
}: {
  lane: Lane;
  cols: number;
  onName: () => void;
  onMark: (nodeId: string) => void;
}) {
  const at = lane.marks.map((m) => m.index);
  const first = at.length ? Math.min(...at) : null;
  const last = at.length ? Math.max(...at) : null;
  // Two marks in one scene (a clue each way) sit side by side, not on top of each other.
  const seen = new Map<number, number>();
  const counts = new Map<number, number>();
  for (const m of lane.marks) counts.set(m.index, (counts.get(m.index) ?? 0) + 1);
  return (
    <div
      className={`${styles.row} ${styles.lane} ${lane.quiet ? styles.quietLane : ""}`}
      style={{ "--lane": lane.color } as React.CSSProperties}
    >
      <button type="button" className={styles.name} onClick={onName} title={lane.name}>
        <span
          className={`${styles.swatch} ${lane.kind === "twist" ? styles.swatchTwist : lane.kind === "setup" ? styles.swatchSetup : ""}`}
          aria-hidden
        />
        <span className={styles.nameText}>
          {lane.name}
          {(lane.edgeIn || lane.edgeOut) && (
            <span className={styles.edge}>{[lane.edgeIn, lane.edgeOut].filter(Boolean).join(", ")}</span>
          )}
        </span>
      </button>
      <div className={styles.track}>
        {lane.span && (
          <span
            className={styles.span}
            style={{ "--from": lane.span[0], "--to": lane.span[1] } as React.CSSProperties}
            aria-hidden
          />
        )}
        {/* A thread from an earlier book runs in from the edge; one going on runs out to it. */}
        {lane.edgeIn && (
          <span
            className={`${styles.span} ${styles.spanEdge}`}
            style={{ "--from": -0.5, "--to": first ?? cols - 0.5 } as React.CSSProperties}
            aria-hidden
          />
        )}
        {lane.edgeOut && (
          <span
            className={`${styles.span} ${styles.spanEdge}`}
            style={{ "--from": last ?? -0.5, "--to": cols - 0.5 } as React.CSSProperties}
            aria-hidden
          />
        )}
        {lane.marks.map((m, k) => {
          const nth = seen.get(m.index) ?? 0;
          seen.set(m.index, nth + 1);
          const dx = (nth - ((counts.get(m.index) ?? 1) - 1) / 2) * 0.6;
          return (
            <button
              key={`${m.index}-${k}`}
              type="button"
              className={`${styles.mark} ${styles[m.shape]}`}
              style={{ "--i": m.index, "--dx": `${dx}rem` } as React.CSSProperties}
              title={`${lane.name}. ${m.label}`}
              aria-label={`${lane.name}. ${m.label}`}
              onClick={() => onMark(m.nodeId)}
            />
          );
        })}
      </div>
    </div>
  );
}
