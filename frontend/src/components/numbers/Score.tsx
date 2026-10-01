import { useNavigate } from "react-router-dom";
import { slotVar } from "../../lib/colorSlots";
import type { BeatMark, CastRow, Lane, PacingBar } from "../../lib/numbers/charts";
import styles from "./Numbers.module.css";

const THREAD_STATUS: Record<string, string> = {
  open: "Open",
  developing: "Developing",
  resolved: "Resolved",
};

/**
 * The book laid out scene by scene, three ways on one axis (doc 13 P3): how long each scene
 * is, where each thread runs, and who is on the page. They line up, so a thin stretch, a
 * thread left hanging and a character gone quiet can be read straight down.
 */
export default function Score({
  storyId,
  bars,
  beats,
  lanes,
  cast,
}: {
  storyId: string;
  bars: PacingBar[];
  beats: BeatMark[];
  lanes: Lane[];
  cast: CastRow[];
}) {
  const navigate = useNavigate();
  const open = (id: string) => navigate(`/stories/${storyId}/write/${id}`);
  const n = bars.length;
  const max = Math.max(1, ...bars.map((b) => b.words));
  const x = (i: number) => `${((i + 0.5) / n) * 100}%`;
  const beatAt = (at: number) => {
    const i = bars.findIndex((b) => b.through >= at);
    return x(i < 0 ? n - 1 : i);
  };
  const onPage = cast.filter((r) => r.count > 0);
  const offPage = cast.filter((r) => r.count === 0);

  return (
    <>
      <section className={styles.section} aria-labelledby="numbers-pacing">
        <h2 className={styles.heading} id="numbers-pacing">
          Pacing
        </h2>
        <p className={styles.lede}>
          Each bar is a scene, as long as its words, coloured by how far along it is.
          {beats.length > 0 &&
            " The marks above are where the beat sheet expects each beat; a filled one has a scene."}
        </p>
        <div className={styles.score}>
          <span className={styles.rowMeta}>{max.toLocaleString()} words</span>
          <div className={styles.bars}>
            {beats.map((b) => (
              <span
                key={b.id}
                className={styles.beat}
                data-placed={b.sceneId ? true : undefined}
                style={{ left: beatAt(b.at) }}
                title={`${b.name}${b.sceneId ? "" : " (no scene yet)"}`}
              />
            ))}
            {bars.map((b, i) => (
              <button
                key={b.id}
                type="button"
                className={styles.bar}
                data-status={b.status}
                data-group-start={i === 0 || bars[i - 1].group !== b.group ? true : undefined}
                style={{
                  height: `${Math.max(2, (b.words / max) * 100)}%`,
                  ["--bar" as string]: `var(--status-${b.status})`,
                }}
                title={`${b.title}: ${b.words.toLocaleString()} words, ${b.status}`}
                aria-label={`${b.title}, ${b.words} words, ${b.status}`}
                onClick={() => open(b.id)}
              />
            ))}
          </div>
          <span />
        </div>
      </section>

      {lanes.length > 0 && (
        <section className={styles.section} aria-labelledby="numbers-threads">
          <h2 className={styles.heading} id="numbers-threads">
            Threads
          </h2>
          <p className={styles.lede}>Where each thread runs, from the first scene it touches to the last.</p>
          <div className={styles.score}>
            {lanes.map(({ thread, hits }) => (
              <Lane key={thread.id} name={thread.name} meta={THREAD_STATUS[thread.status] ?? thread.status}>
                {hits.length > 0 && (
                  <span
                    className={styles.span}
                    style={{
                      left: x(hits[0]),
                      width: `${((hits[hits.length - 1] - hits[0]) / n) * 100}%`,
                      background: slotVar(thread.color_slot),
                    }}
                  />
                )}
                {hits.map((i) => (
                  <span
                    key={i}
                    className={styles.hit}
                    style={{ left: x(i), background: slotVar(thread.color_slot) }}
                    title={bars[i]?.title}
                  />
                ))}
              </Lane>
            ))}
          </div>
        </section>
      )}

      {cast.length > 0 && (
        <section className={styles.section} aria-labelledby="numbers-cast">
          <h2 className={styles.heading} id="numbers-cast">
            Who is on the page
          </h2>
          <p className={styles.lede}>
            A square for every scene each character is in, from the point of view, what they say and who the
            prose names.
          </p>
          <div className={styles.score}>
            {onPage.map((r) => (
              <CastLine key={r.character.id} row={r} total={n} />
            ))}
          </div>
          {offPage.length > 0 && (
            <p className={styles.lede}>
              Not on the page yet: {offPage.map((r) => r.character.name).join(", ")}.
            </p>
          )}
        </section>
      )}
    </>
  );
}

function Lane({ name, meta, children }: { name: string; meta: string; children: React.ReactNode }) {
  return (
    <>
      <span className={styles.rowLabel} title={name}>
        {name}
      </span>
      <div className={styles.track}>{children}</div>
      <span className={styles.rowMeta}>{meta}</span>
    </>
  );
}

function CastLine({ row, total }: { row: CastRow; total: number }) {
  const { character, present, count, quiet, milestones } = row;
  const arc = milestones.total ? ` · arc ${milestones.done}/${milestones.total}` : "";
  return (
    <>
      <span className={styles.rowLabel} title={character.name}>
        {character.name}
      </span>
      <div
        className={styles.cells}
        role="img"
        aria-label={`${character.name}: in ${count} of ${total} scenes`}
      >
        {present.map((p, i) => (
          <span
            key={i}
            className={styles.cell}
            style={p ? { background: slotVar(character.color_slot) } : undefined}
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
