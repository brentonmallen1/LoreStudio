import { Link, useNavigate } from "react-router-dom";
import { slotVar } from "../../lib/colorSlots";
import { useStoryStore } from "../../stores/storyStore";
import { sharesThen } from "../../lib/numbers/compare";
import type { Figures } from "../../lib/numbers/figures";
import SectionHeading from "./SectionHeading";
import styles from "./Numbers.module.css";

function balanceWords(b: number): string {
  if (b >= 75) return "shared fairly evenly";
  if (b >= 50) return "led by a few voices";
  return "dominated by one or two voices";
}

/**
 * Who talks, how much, to whom, and where one voice takes over (doc 13 P3). Compared (doc 19),
 * each speaker's earlier share is a second tick on their track and the row says what it was.
 */
export default function Dialogue({
  storyId,
  dialogue,
  then,
}: {
  storyId: string;
  dialogue: Figures["dialogue"];
  then: Figures | null;
}) {
  const before = then ? sharesThen(then) : null;
  const balanceThen = then?.dialogue.balance ?? null;
  const navigate = useNavigate();
  const characters = useStoryStore((s) => s.characters);
  const { speakers } = dialogue;
  const spoken = speakers.reduce((a, s) => a + s.word_count, 0);
  // Eight rows at most: past that, the rest share one row, so the shares still add up.
  const top = speakers.length > 8 ? speakers.slice(0, 7) : speakers;
  const rest = speakers.slice(top.length);
  const share = (words: number) => (spoken ? (words / spoken) * 100 : 0);
  const even = speakers.length ? 100 / speakers.length : 0;
  const colour = (id: string | null) => slotVar(characters.find((c) => c.id === id)?.color_slot);

  return (
    <section className={styles.section} aria-labelledby="numbers-dialogue">
      <SectionHeading section="dialogue" title="Dialogue" />
      {dialogue.total_lines === 0 ? (
        <p className={styles.lede}>
          Nobody speaks yet. Lines in quotation marks are counted here as you write them.
        </p>
      ) : (
        <>
          <p className={styles.lede}>
            <strong>{dialogue.total_lines.toLocaleString()}</strong> lines of dialogue
            {dialogue.balance !== null && (
              <>
                , {balanceWords(dialogue.balance)} (balance {dialogue.balance} of 100
                {then && balanceThen !== null && balanceThen !== dialogue.balance && `, was ${balanceThen}`})
              </>
            )}
            .
            {dialogue.unattributed > 0 && (
              <>
                {" "}
                {dialogue.unattributed} {dialogue.unattributed === 1 ? "has" : "have"} no speaker yet and{" "}
                {dialogue.unattributed === 1 ? "is" : "are"} left out below:{" "}
                <Link to={`/stories/${storyId}/proposals?kind=dialogue`}>tag them in Proposals</Link>.
              </>
            )}
          </p>
          <div
            className={styles.share}
            data-one={speakers.length < 2 ? true : undefined}
            style={{ "--even": `${even}%` } as React.CSSProperties}
          >
            {top.map((s) => (
              <SpeakerLine
                key={s.speaker_name}
                name={s.speaker_name}
                share={share(s.word_count)}
                was={before ? (before.get(s.character_id ?? s.speaker_name) ?? 0) : undefined}
                colour={colour(s.character_id)}
                meta={`${s.word_count.toLocaleString()} words · ${s.line_count} ${s.line_count === 1 ? "line" : "lines"}`}
              />
            ))}
            {rest.length > 0 && (
              <SpeakerLine
                name={`${rest.length} others`}
                share={share(rest.reduce((a, s) => a + s.word_count, 0))}
                colour="var(--color-text-subtle)"
                meta={`${rest.reduce((a, s) => a + s.word_count, 0).toLocaleString()} words`}
              />
            )}
          </div>
          {speakers.length > 1 && (
            <div className={styles.legend}>
              <span>
                <i className={styles.evenKey} />
                an even share, {Math.round(even)}% each among {speakers.length} speakers
              </span>
            </div>
          )}
          {then && (
            <div className={styles.legend}>
              <span>
                <i className={styles.wasKey} />
                each speaker&rsquo;s share then
              </span>
            </div>
          )}
          {((dialogue.pairs?.length ?? 0) > 0 || (dialogue.monologue_scenes?.length ?? 0) > 0) && (
            <ul className={styles.list}>
              {(dialogue.pairs ?? []).slice(0, 5).map((p) => (
                <li key={`${p.a_id}-${p.b_id}`}>
                  {p.a_name} and {p.b_name} talk in {p.scene_count} {p.scene_count === 1 ? "scene" : "scenes"}
                  .
                </li>
              ))}
              {(dialogue.monologue_scenes ?? []).map((m) => (
                <li key={m.scene_id}>
                  In{" "}
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => navigate(`/stories/${storyId}/write/${m.scene_id}`)}
                  >
                    {m.scene_title}
                  </button>
                  , {m.speaker} has {m.pct}% of the words spoken.
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function percent(share: number): string {
  return share > 0 && share < 1 ? "<1%" : `${Math.round(share)}%`;
}

/** A speaker's share of every word spoken: the track is the whole, the fill is theirs. */
function SpeakerLine({
  name,
  share,
  was,
  colour,
  meta,
}: {
  name: string;
  share: number;
  /** Their share then, when comparing (doc 19); 0 for a speaker who had none. */
  was?: number;
  colour: string;
  meta: string;
}) {
  const moved = was !== undefined && Math.round(was) !== Math.round(share);
  return (
    <>
      <span className={styles.rowLabel} title={name}>
        {name}
      </span>
      <div
        className={styles.shareTrack}
        role="img"
        aria-label={`${name}: ${percent(share)} of the words spoken${moved ? `, was ${percent(was)}` : ""}`}
      >
        <div className={styles.shareBar} style={{ width: `${share}%`, ["--bar" as string]: colour }} />
        {was !== undefined && <span className={styles.shareThen} style={{ left: `${was}%` }} aria-hidden />}
      </div>
      <span className={styles.rowMeta}>
        <strong>{percent(share)}</strong>
        {moved && `, was ${percent(was)}`} · {meta}
      </span>
    </>
  );
}
