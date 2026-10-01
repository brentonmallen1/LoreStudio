import { Link, useNavigate } from "react-router-dom";
import { slotVar } from "../../lib/colorSlots";
import { useStoryStore } from "../../stores/storyStore";
import type { NumbersDialogue } from "../../types/numbers";
import styles from "./Numbers.module.css";

function balanceWords(b: number): string {
  if (b >= 75) return "shared fairly evenly";
  if (b >= 50) return "led by a few voices";
  return "dominated by one or two voices";
}

/** Who talks, how much, to whom, and where one voice takes over (doc 13 P3). */
export default function Dialogue({ storyId, dialogue }: { storyId: string; dialogue: NumbersDialogue }) {
  const navigate = useNavigate();
  const characters = useStoryStore((s) => s.characters);
  const top = dialogue.speakers.slice(0, 8);
  const most = Math.max(1, ...top.map((s) => s.word_count));
  const colour = (id: string | null) => slotVar(characters.find((c) => c.id === id)?.color_slot);

  return (
    <section className={styles.section} aria-labelledby="numbers-dialogue">
      <h2 className={styles.heading} id="numbers-dialogue">
        Dialogue
      </h2>
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
                , {balanceWords(dialogue.balance)} (balance {dialogue.balance} of 100)
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
          <div className={styles.share}>
            {top.map((s) => (
              <SpeakerLine
                key={s.speaker_name}
                name={s.speaker_name}
                width={(s.word_count / most) * 100}
                colour={colour(s.character_id)}
                meta={`${s.word_count.toLocaleString()} words · ${s.line_count} ${s.line_count === 1 ? "line" : "lines"}`}
              />
            ))}
          </div>
          {(dialogue.pairs.length > 0 || dialogue.monologue_scenes.length > 0) && (
            <ul className={styles.list}>
              {dialogue.pairs.slice(0, 5).map((p) => (
                <li key={`${p.a_id}-${p.b_id}`}>
                  {p.a_name} and {p.b_name} talk in {p.scene_count} {p.scene_count === 1 ? "scene" : "scenes"}
                  .
                </li>
              ))}
              {dialogue.monologue_scenes.map((m) => (
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

function SpeakerLine({
  name,
  width,
  colour,
  meta,
}: {
  name: string;
  width: number;
  colour: string;
  meta: string;
}) {
  return (
    <>
      <span className={styles.rowLabel} title={name}>
        {name}
      </span>
      <div>
        <div
          className={styles.shareBar}
          style={{ width: `${Math.max(1, width)}%`, ["--bar" as string]: colour }}
        />
      </div>
      <span className={styles.rowMeta}>{meta}</span>
    </>
  );
}
