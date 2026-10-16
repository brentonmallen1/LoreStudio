import { useState } from "react";
import { X } from "lucide-react";
import { whereWords, type Moment } from "../../lib/patterns";
import type { StructureNode } from "../../types";
import { usePattern } from "./usePattern";
import styles from "./Pattern.module.css";

/**
 * Where the story stands against the pattern turned on (doc 29 D5, B-BeatPicker): a strip with
 * each moment where it tends to fall, filled when a scene carries it and dashed when nothing
 * does yet, over a bar of how much has words. Each moment opens a card: what it is in plain
 * words, roughly where it falls, and the scene of this story that carries it.
 */
export default function PatternStrip({ onReveal }: { onReveal: (nodeId: string) => void }) {
  const { sheet, standing, scenes, carry } = usePattern();
  const [chosen, setChosen] = useState<string | null>(null);
  if (!sheet || !standing) return null;
  const { moments, written } = standing;
  const open = moments.find((m) => m.beat.id === chosen) ?? null;
  const missing = moments.filter((m) => !m.carriers.length).length;

  return (
    <section className={styles.strip} aria-label={`${sheet.name}: where your story stands`}>
      <h2 className={styles.stripTitle}>
        With {sheet.name} on: where your story stands
        <span className={styles.stripCount}>
          {moments.length - missing} of {moments.length} moments have a scene
        </span>
      </h2>
      <div className={styles.track} aria-hidden>
        <span className={styles.line} />
        <span className={styles.written} style={{ width: `${written}%` }} />
        {moments.map((m) => (
          <span
            key={m.beat.id}
            className={styles.dot}
            data-carried={m.carriers.length > 0 || undefined}
            data-on={m.beat.id === chosen || undefined}
            style={{ left: `${Math.min(Math.max(m.beat.position_pct, 0), 100)}%` }}
            title={m.beat.name}
            onClick={() => setChosen(m.beat.id === chosen ? null : m.beat.id)}
          />
        ))}
      </div>
      <ol className={styles.moments}>
        {moments.map((m) => (
          <li key={m.beat.id}>
            <button
              type="button"
              className={styles.moment}
              data-carried={m.carriers.length > 0 || undefined}
              aria-pressed={m.beat.id === chosen}
              aria-label={`${m.beat.name}, ${m.carriers.length ? "a scene carries it" : "nothing there yet"}`}
              onClick={() => setChosen(m.beat.id === chosen ? null : m.beat.id)}
            >
              <span className={styles.momentMark} aria-hidden />
              {m.beat.name}
            </button>
          </li>
        ))}
      </ol>
      <div className={styles.legend} aria-hidden>
        <span>
          <span className={styles.legendDot} data-carried /> a scene carries it
        </span>
        <span>
          <span className={styles.legendDot} /> nothing there yet
        </span>
        <span>
          <span className={styles.legendBar} /> written so far, as a share of the scenes
        </span>
      </div>
      {open && (
        <MomentCard
          moment={open}
          scenes={scenes}
          onClose={() => setChosen(null)}
          onReveal={onReveal}
          onCarry={carry}
        />
      )}
      <p className={styles.notMistakes}>
        Moments with nothing there yet aren't mistakes. A pattern is a map of what often works, not a rule.
      </p>
    </section>
  );
}

/** One moment: what it is, roughly where it falls, and the scene that carries it here. */
function MomentCard({
  moment,
  scenes,
  onClose,
  onReveal,
  onCarry,
}: {
  moment: Moment;
  scenes: StructureNode[];
  onClose: () => void;
  onReveal: (nodeId: string) => void;
  onCarry: (nodeId: string, beatId: string | null) => Promise<void>;
}) {
  const { beat, carriers } = moment;
  const [giving, setGiving] = useState(false);
  const [pick, setPick] = useState("");
  return (
    <section className={styles.card} aria-label={beat.name}>
      <button type="button" className={styles.close} onClick={onClose} aria-label={`Close ${beat.name}`}>
        <X size={14} aria-hidden />
      </button>
      <span className={styles.where}>{whereWords(beat.position_pct)}</span>
      <h3 className={styles.cardTitle}>{beat.name}</h3>
      {beat.description && <p className={styles.cardWhat}>{beat.description}</p>}
      <div className={styles.inStory}>
        <span className={styles.inStoryLabel}>In your story</span>
        {carriers.length ? (
          carriers.map(({ node }) => (
            <div key={node.id} className={styles.carrier}>
              <span>
                <strong>{node.title || "Untitled"}</strong>, scene {scenes.indexOf(node) + 1} of{" "}
                {scenes.length}
                {node.synopsis ? `: ${node.synopsis}` : ""}
              </span>
              <span className={styles.cardButtons}>
                <button type="button" className={styles.btn} onClick={() => onReveal(node.id)}>
                  Open in the Outline
                </button>
                <button type="button" className={styles.btn} onClick={() => void onCarry(node.id, null)}>
                  Not this one
                </button>
              </span>
            </div>
          ))
        ) : (
          <span className={styles.nothing}>
            Nothing carries it yet. That's fine: not every story needs it.
          </span>
        )}
      </div>
      {giving ? (
        <div className={styles.give}>
          <label className={styles.giveLabel}>
            Which scene carries it?
            <select
              autoFocus
              className={styles.select}
              value={pick}
              onChange={(e) => setPick(e.target.value)}
            >
              <option value="">Choose a scene…</option>
              {scenes.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {i + 1}. {s.title || "Untitled"}
                </option>
              ))}
            </select>
          </label>
          <span className={styles.cardButtons}>
            <button
              type="button"
              className={styles.btn}
              disabled={!pick}
              onClick={() => {
                void onCarry(pick, beat.id);
                setGiving(false);
                setPick("");
              }}
            >
              Give it to this scene
            </button>
            <button type="button" className={styles.btn} onClick={() => setGiving(false)}>
              Cancel
            </button>
          </span>
        </div>
      ) : (
        <button type="button" className={styles.btn} onClick={() => setGiving(true)}>
          {carriers.length ? "Give it to another scene…" : "Give it to a scene…"}
        </button>
      )}
    </section>
  );
}
