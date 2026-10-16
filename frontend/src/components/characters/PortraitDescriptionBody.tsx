import { readPortrait } from "../../lib/characters/portraitReading";
import styles from "../lorebook/Lorebook.module.css";

/**
 * What the Assistant read in a character's portrait (A7): suggestions to copy, never written
 * in on their own. Kept on the character and shown in the sheet's band until cleared or asked
 * again; it used to be a card that went when the sheet closed.
 */
export default function PortraitDescriptionBody({ data }: { data: Record<string, unknown> }) {
  const desc = readPortrait(data.text);
  if (!desc) return <p className={styles.cardHint}>{String(data.text ?? "")}</p>;
  const rows: [string, string | string[] | undefined][] = [
    ["Visible in the image", desc.observations],
    ["Appearance", desc.appearance],
    ["Personality", desc.personality],
    ["Voice", desc.voice],
    ["Age", desc.age_estimate],
    ["Worth deciding", desc.questions],
  ];
  return (
    <div>
      {rows
        .filter(([, v]) => v && (!Array.isArray(v) || v.length))
        .map(([k, v]) => (
          <div key={k} className={styles.field}>
            <span className={styles.fieldLabel}>{k}</span>
            <span className={styles.cardHint}>{Array.isArray(v) ? v.join(" · ") : v}</span>
          </div>
        ))}
      <p className={styles.cardHint}>Suggestions from the Assistant: copy what is useful into the fields.</p>
    </div>
  );
}
