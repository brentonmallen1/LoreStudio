import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { joinSteps, splitSteps } from "../../lib/scene/steps";
import { useAutosaveField } from "../plan/useAutosaveField";
import styles from "./SceneSheet.module.css";

/**
 * A scene's key events as numbered steps (doc 24, canvas 8e), saved as one text field, one
 * step per line. Enter starts the next step, Backspace in an empty one removes it, ↑ and ↓
 * move between them. Key it by the node.
 */
export default function KeyEvents({
  initial,
  save,
}: {
  initial: string;
  save: (value: string) => Promise<unknown>;
}) {
  const field = useAutosaveField(initial, save);
  const [steps, setSteps] = useState(() => splitSteps(initial));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  // A step added or removed takes the focus once it is drawn.
  const focusNext = useRef<number | null>(null);
  useEffect(() => {
    if (focusNext.current === null) return;
    inputs.current[focusNext.current]?.focus();
    focusNext.current = null;
  });

  function update(next: string[]) {
    setSteps(next);
    field.change(joinSteps(next));
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      focusNext.current = i + 1;
      update([...steps.slice(0, i + 1), "", ...steps.slice(i + 1)]);
    } else if (e.key === "Backspace" && steps[i] === "" && steps.length > 0) {
      e.preventDefault();
      focusNext.current = Math.max(0, i - 1);
      update(steps.filter((_, j) => j !== i));
    } else if (e.key === "ArrowDown" && i < steps.length - 1) {
      e.preventDefault();
      inputs.current[i + 1]?.focus();
    } else if (e.key === "ArrowUp" && i > 0) {
      e.preventDefault();
      inputs.current[i - 1]?.focus();
    }
  }

  return (
    <div className={styles.field}>
      <span className={styles.label} id="key-events">
        Key events
      </span>
      <ol className={styles.steps} aria-labelledby="key-events">
        {steps.map((step, i) => (
          <li key={i} className={styles.step}>
            <span className={styles.stepNo} aria-hidden>
              {i + 1}
            </span>
            <input
              ref={(el) => {
                inputs.current[i] = el;
              }}
              className={styles.stepText}
              value={step}
              aria-label={`Key event ${i + 1}`}
              placeholder="What happens next…"
              onChange={(e) => update(steps.map((s, j) => (j === i ? e.target.value : s)))}
              onKeyDown={(e) => onKey(e, i)}
              onBlur={field.flush}
            />
          </li>
        ))}
      </ol>
      <button
        type="button"
        className={styles.addStep}
        onClick={() => {
          focusNext.current = steps.length;
          update([...steps, ""]);
        }}
      >
        <Plus size={13} aria-hidden />
        {steps.length ? "Add a step" : "Add the first key event: what must happen in this scene"}
      </button>
    </div>
  );
}
