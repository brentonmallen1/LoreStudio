import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  COLLAPSED_PX,
  colourFor,
  stopShape,
  type ColourContext,
  type ColourMode,
  type Line,
  type Station,
  type Stop,
} from "../../lib/strip/stripModel";
import { usePanelStore } from "../../stores/panelStore";
import { stopClick } from "../../lib/panel/openScene";
import { MODIFIER } from "../../lib/keyboard/shortcuts";
import { entityColor } from "../panel/entityColor";
import { useTwistScenes } from "../../lib/twists/useTwistScenes";
import styles from "./Strip.module.css";

/** A stop shows at most this many colour pips (a 2×2 grid); the peek and title name the rest. */
const MAX_PIPS = 4;

interface Props {
  line: Line;
  mode: ColourMode;
  ctx: ColourContext;
  storyId: string;
}

type PeekBody = { kind: "stop"; stop: Stop } | { kind: "station"; station: Station };
type Peek = PeekBody & { top: number };

/**
 * The collapsed strip: a transit line. Numbered stations are the level above scenes and
 * open that chapter's own page; stops are scenes. Behind you the line is solid, ahead it
 * is faint, and planned stretches are dashed. Scene state is always the stop's shape;
 * the colour mode adds who, threads, status or beat on top.
 */
export default function TransitStrip({ line, mode, ctx, storyId }: Props) {
  const navigate = useNavigate();
  const highlight = usePanelStore((s) => s.highlight);
  const twistScenes = useTwistScenes(storyId, highlight?.kind === "twist" ? highlight.id : null);
  const [peek, setPeek] = useState<Peek | null>(null);
  const go = (id: string | undefined) => id && navigate(`/stories/${storyId}/write/${id}`);

  function railClass(stop: Stop | undefined): string {
    if (!stop) return styles.railNone;
    if (stop.planned) return styles.railPlan;
    return stop.index <= line.currentIndex ? styles.railPast : "";
  }
  function present(stop: Stop): boolean {
    if (!highlight || !stop.cast) return false;
    if (highlight.kind === "character") return stop.cast.character_ids.includes(highlight.id);
    if (highlight.kind === "location") return stop.cast.location_ids.includes(highlight.id);
    if (highlight.kind === "thread") return stop.cast.thread_ids.includes(highlight.id);
    if (highlight.kind === "twist") return twistScenes.has(stop.cast.node_id);
    return false;
  }
  const peekAt = (e: React.MouseEvent, next: PeekBody) =>
    setPeek({ ...next, top: (e.currentTarget as HTMLElement).getBoundingClientRect().top });

  return (
    <div className={styles.line} onMouseLeave={() => setPeek(null)}>
      {line.acts.map((act) => (
        <div key={act.key}>
          {line.hasActs && (
            <button
              className={`${styles.row} ${styles.rowAct}`}
              onClick={() => go(act.node?.id)}
              title={act.title ? `${act.title}: open its plan` : undefined}
              aria-label={act.title || `Act ${act.label}`}
            >
              <span className={`${styles.rail} ${railClass(act.stations[0]?.stops[0])}`} />
              <span
                className={`${styles.actLabel} ${act.key === line.currentActKey ? styles.actLabelOn : ""}`}
              >
                {act.label}
              </span>
            </button>
          )}
          {act.stations.map((station) => (
            <div key={station.key}>
              {line.hasStations && (
                <button
                  className={`${styles.row} ${styles.rowStation}`}
                  onClick={() => go(station.node?.id)}
                  onMouseEnter={(e) => peekAt(e, { kind: "station", station })}
                  aria-label={`${station.title || `Chapter ${station.number}`}, ${Math.round(station.done * 100)}% final: open its plan`}
                  data-station={station.number}
                >
                  <span className={`${styles.rail} ${railClass(station.stops[0])}`} />
                  <span
                    className={[
                      styles.station,
                      station.planned ? styles.stationPlanned : "",
                      station.key === line.currentStationKey ? styles.stationCurrent : "",
                      line.currentIndex < 0 && station.key === line.currentStationKey
                        ? styles.stationSelected
                        : "",
                    ].join(" ")}
                    style={{ "--done": station.done } as React.CSSProperties}
                  >
                    <span className={styles.stationInner}>{station.number}</span>
                  </span>
                </button>
              )}
              {station.stops.map((stop) => {
                const swatches = colourFor(mode, stop, ctx);
                const shape = stopShape(stop.status);
                const current = stop.index === line.currentIndex;
                const ahead = stop.index > line.currentIndex && !stop.planned;
                const isPresent = present(stop);
                return (
                  <button
                    key={stop.node.id}
                    className={`${styles.row} ${styles.rowStop}`}
                    onClick={(e) => stopClick(e, stop.node.id, go)}
                    onMouseEnter={(e) => peekAt(e, { kind: "stop", stop })}
                    aria-label={`${stop.node.title}${stop.planned ? " (planned)" : ""}${isPresent && highlight ? `, with ${highlight.name}` : ""}`}
                    aria-current={current ? "page" : undefined}
                    data-stop={stop.index}
                  >
                    <span className={`${styles.rail} ${railClass(stop)}`} />
                    {swatches.length > 1 ? (
                      <span
                        className={`${styles.pill} ${current ? styles.pillCurrent : ""}`}
                        style={{ opacity: ahead ? 0.55 : 1 }}
                        title={swatches.map((s) => s.label).join(", ")}
                      >
                        {swatches.slice(0, MAX_PIPS).map((s) => (
                          <span
                            key={s.label}
                            className={`${styles.pip} ${shape === "hollow" ? styles.pipHollow : ""}`}
                            style={
                              {
                                background: shape === "hollow" ? undefined : s.color,
                                "--pip-color": s.color,
                              } as React.CSSProperties
                            }
                          />
                        ))}
                      </span>
                    ) : (
                      <span
                        className={[
                          styles.dot,
                          shape === "hollow" ? styles.dotHollow : "",
                          shape === "dashed" ? styles.dotDashed : "",
                          shape === "ringed" ? styles.dotRinged : "",
                          current ? styles.dotCurrent : "",
                          ahead && !swatches.length ? styles.dotAhead : "",
                        ].join(" ")}
                        style={
                          {
                            "--stop-color": swatches[0]?.color,
                            opacity: ahead && swatches.length ? 0.55 : undefined,
                          } as React.CSSProperties
                        }
                      />
                    )}
                    {isPresent && highlight && (
                      <span
                        className={styles.presence}
                        style={{ background: entityColor(highlight.kind, highlight.id) }}
                        title={`${highlight.name} is in this scene`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ))}
      {peek && <PeekCard peek={peek} mode={mode} ctx={ctx} />}
    </div>
  );
}

function PeekCard({ peek, mode, ctx }: { peek: Peek; mode: ColourMode; ctx: ColourContext }) {
  const top = Math.min(peek.top - 8, window.innerHeight - 160);
  if (peek.kind === "station") {
    const st = peek.station;
    return (
      <div className={styles.peek} style={{ top, left: COLLAPSED_PX + 8 }} role="tooltip">
        <span className={styles.peekKicker}>
          Chapter {st.number} · {st.stops.length} {st.stops.length === 1 ? "scene" : "scenes"} · click for its
          plan
        </span>
        <span className={styles.peekTitle}>{st.title}</span>
        {st.node?.synopsis && <span className={styles.peekText}>{st.node.synopsis}</span>}
        <span className={styles.peekKicker}>
          {st.planned
            ? "Planned"
            : `${st.words.toLocaleString()} words · ${Math.round(st.done * 100)}% final`}
        </span>
      </div>
    );
  }
  const s = peek.stop;
  const tags = colourFor(mode === "status" ? "none" : mode, s, ctx);
  return (
    <div className={styles.peek} style={{ top, left: COLLAPSED_PX + 8 }} role="tooltip">
      <span className={styles.peekKicker}>
        {s.planned ? "Planned" : `${s.words.toLocaleString()} words · ${s.status}`}
      </span>
      <span className={styles.peekTitle}>{s.node.title}</span>
      {s.node.synopsis && <span className={styles.peekText}>{s.node.synopsis}</span>}
      <span className={styles.peekKicker}>{MODIFIER.alt}-click to read it beside yours</span>
      {tags.length > 0 && (
        <span className={styles.peekTags}>
          {tags.map((t) => (
            <span key={t.label} className={styles.peekTag}>
              <span className={styles.swatch} style={{ background: t.color }} />
              {t.label}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
