import { useMemo, useState } from "react";
import { landingLine, placeSpots, type PlaceSpot } from "../../lib/outline/place";
import { shapeOf } from "../../lib/outline/tree";
import { useStoryStore } from "../../stores/storyStore";
import styles from "./SceneChooser.module.css";

export type SceneHow = "plan" | "start" | "idea";

export type SceneChoice = { how: "plan" | "start"; title: string; spot: PlaceSpot | null } | { how: "idea" };

const HOWS: { id: SceneHow; label: string; hint: string }[] = [
  {
    id: "plan",
    label: "Plan a scene",
    hint: "The words become what happens, for a scene you'll write later.",
  },
  { id: "start", label: "Start a scene", hint: "The words become its first draft." },
  {
    id: "idea",
    label: "Save as an idea",
    hint: "The words go to the Outline's Not placed yet tray, to place when you know where.",
  },
];

/**
 * Make a scene from words on the Freewrite page (doc 29 D9), saying which: plan one (the words
 * are what happens), start one (they are its first draft), or keep them as an idea in the
 * Outline's tray. Where the scene lands is shown before it is made, with a list to place it.
 */
export default function SceneChooser({
  words,
  busy,
  onMake,
  onCancel,
}: {
  words: string;
  busy: boolean;
  onMake: (choice: SceneChoice) => void;
  onCancel: () => void;
}) {
  const structure = useStoryStore((s) => s.structure);
  const template = useStoryStore((s) => s.activeTemplate);
  const shape = useMemo(() => shapeOf(template), [template]);
  const spots = useMemo(() => placeSpots(structure, shape), [structure, shape]);
  const word = (shape.names[shape.flat ? 0 : shape.names.length - 1] ?? "Scene").toLowerCase();
  const [how, setHow] = useState<SceneHow>("plan");
  const [title, setTitle] = useState(() => firstWords(words, 6));
  // At the end of the story to start with: after the last scene of the last part.
  const [key, setKey] = useState(() => spots.at(-1)?.key ?? "");
  const spot = spots.find((s) => s.key === key) ?? null;
  const groups = [...new Set(spots.map((s) => s.group))];
  const ok = how === "idea" || !!title.trim();

  return (
    <form
      className={styles.chooser}
      aria-label="Make a scene"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok || busy) return;
        onMake(how === "idea" ? { how } : { how, title: title.trim(), spot });
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <fieldset className={styles.hows}>
        <legend className={styles.legend}>Make a scene from these words</legend>
        {HOWS.map((h) => (
          <label key={h.id} className={styles.how} data-on={how === h.id || undefined}>
            <input type="radio" name="scene-how" checked={how === h.id} onChange={() => setHow(h.id)} />
            <span>
              <span className={styles.howLabel}>{h.label}</span>
              <span className={styles.howHint}>{h.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {how === "idea" ? (
        <p className={styles.where}>Goes to the Outline's Not placed yet tray.</p>
      ) : (
        <>
          <label className={styles.field}>
            Title
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`The ${word}'s title`}
              autoFocus
            />
          </label>
          <div className={styles.field}>
            <span className={styles.where} aria-live="polite">
              {landingLine(spot, word)}
            </span>
            {spots.length > 0 && (
              <select
                className={styles.input}
                value={key}
                aria-label={`Where the new ${word} goes`}
                onChange={(e) => setKey(e.target.value)}
              >
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {spots
                      .filter((s) => s.group === g)
                      .map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>
        </>
      )}
      <p className={styles.stay}>The words stay on this page, marked with where they went.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onCancel}>
          Back
        </button>
        <button type="submit" className={styles.primary} disabled={!ok || busy}>
          {how === "plan" ? "Plan it" : how === "start" ? "Start it" : "Save the idea"}
        </button>
      </div>
    </form>
  );
}

function firstWords(text: string, n: number): string {
  return text
    .trim()
    .split(/\s+/)
    .slice(0, n)
    .join(" ")
    .replace(/[.,;:!?]+$/, "");
}
