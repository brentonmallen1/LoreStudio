import { useState } from "react";
import { Info } from "lucide-react";
import { Modal } from "../common";
import { ABOUT, type NumbersSection } from "../../lib/numbers/about";
import styles from "./Numbers.module.css";

const PARTS = [
  ["measures", "What it measures"],
  ["why", "Why it is here"],
  ["reading", "How to read it"],
] as const;

/** A section's heading, with an ⓘ beside it that says what the section measures and how to read it. */
export default function SectionHeading({
  section,
  title,
  tone,
}: {
  section: NumbersSection;
  title: string;
  tone?: "nlp";
}) {
  const [open, setOpen] = useState(false);
  const about = ABOUT[section];
  return (
    <div className={styles.headingRow}>
      <h2 className={styles.heading} data-tone={tone} id={`numbers-${section}`}>
        {title}
      </h2>
      <button
        type="button"
        className={styles.about}
        title={`About ${title}`}
        aria-label={`About ${title}`}
        onClick={() => setOpen(true)}
      >
        <Info size={14} aria-hidden />
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={title} icon={<Info size={15} />}>
        <div className={styles.aboutBody}>
          {PARTS.map(([key, label]) => (
            <section key={key}>
              <h3>{label}</h3>
              {about[key].map((p) => (
                <p key={p}>{p}</p>
              ))}
            </section>
          ))}
        </div>
      </Modal>
    </div>
  );
}
