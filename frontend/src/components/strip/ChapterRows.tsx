import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { colourFor, type ColourContext, type ColourMode, type Line } from "../../lib/strip/stripModel";
import styles from "./Strip.module.css";

interface Props {
  line: Line;
  mode: ColourMode;
  ctx: ColourContext;
  storyId: string;
}

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** The middle width: one row per chapter with its scenes as small bars; click a chapter to unfold it. */
export default function ChapterRows({ line, mode, ctx, storyId }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(line.currentStationKey ? [line.currentStationKey] : []),
  );
  const go = (id: string | undefined) => id && navigate(`/stories/${storyId}/write/${id}`);
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className={styles.rows}>
      {line.acts.map((act) => (
        <div key={act.key}>
          {line.hasActs && (
            <button className={styles.rowsAct} onClick={() => go(act.node?.id)} title="Open the act's plan">
              {act.label} · {act.title}
            </button>
          )}
          {act.stations.map((st) => {
            const isOpen = open.has(st.key);
            const current = st.key === line.currentStationKey;
            return (
              <div key={st.key} className={`${styles.chapter} ${current ? styles.chapterCurrent : ""}`}>
                <button
                  className={styles.chapterHead}
                  onClick={() => (line.hasStations ? toggle(st.key) : undefined)}
                  onDoubleClick={() => go(st.node?.id)}
                  aria-expanded={isOpen}
                  title={st.node ? "Click to unfold; double-click for the chapter's plan" : undefined}
                >
                  {line.hasStations && <span className={styles.chapterNum}>{st.number}</span>}
                  <span className={styles.chapterTitle}>{st.title || "Scenes"}</span>
                  <span className={styles.chapterMeta}>{st.planned ? "planned" : fmt(st.words)}</span>
                </button>
                {!isOpen && (
                  <div className={styles.bars}>
                    {st.stops.map((s) => {
                      const c = colourFor(mode, s, ctx)[0];
                      return (
                        <button
                          key={s.node.id}
                          className={`${styles.bar} ${s.planned ? styles.barPlanned : ""} ${s.index === line.currentIndex ? styles.barCurrent : ""}`}
                          style={
                            {
                              width: s.planned ? 22 : Math.min(48, 12 + Math.round(s.words / 20)),
                              "--stop-color": c?.color,
                            } as React.CSSProperties
                          }
                          onClick={() => go(s.node.id)}
                          title={s.node.title}
                          aria-label={s.node.title}
                        />
                      );
                    })}
                  </div>
                )}
                {isOpen &&
                  st.stops.map((s) => {
                    const c = colourFor(mode, s, ctx)[0];
                    const current = s.index === line.currentIndex;
                    return (
                      <button
                        key={s.node.id}
                        className={`${styles.sceneRow} ${current ? styles.sceneRowCurrent : ""} ${s.planned ? styles.sceneRowPlanned : ""}`}
                        onClick={() => go(s.node.id)}
                        aria-current={current ? "page" : undefined}
                      >
                        <span
                          className={`${styles.dot} ${s.planned ? styles.dotDashed : ""}`}
                          style={
                            {
                              width: 8,
                              height: 8,
                              "--stop-color": c?.color ?? (current ? "var(--color-bg)" : undefined),
                            } as React.CSSProperties
                          }
                        />
                        <span className={styles.sceneTitle}>{s.node.title}</span>
                        <span
                          className={styles.chapterMeta}
                          style={current ? { color: "inherit" } : undefined}
                        >
                          {s.planned ? "plan" : fmt(s.words)}
                        </span>
                      </button>
                    );
                  })}
                {isOpen && st.node && (
                  <button
                    className={styles.sceneRow}
                    style={{ color: "var(--color-text-subtle)" }}
                    onClick={() => go(st.node?.id)}
                  >
                    Open the chapter's plan →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
