import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronRight, Info } from "lucide-react";
import { Modal } from "../common";
import { ABOUT, type NumbersSection } from "../../lib/numbers/about";
import styles from "./Numbers.module.css";

const PARTS = [
  ["measures", "What it measures"],
  ["why", "Why it is here"],
  ["reading", "How to read it"],
  ["compared", "When comparing"],
] as const;

/**
 * A section's heading, with an ⓘ beside it that says what the section measures and how to read it.
 * Given `fold`, the title opens and closes the section, and `note` says what is inside while shut.
 */
export default function SectionHeading({
  section,
  title,
  tone,
  fold,
  note,
}: {
  section: NumbersSection;
  title: string;
  tone?: "nlp";
  fold?: { open: boolean; toggle: () => void };
  note?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const about = ABOUT[section];
  return (
    <div className={styles.headingRow}>
      <h2 className={styles.heading} data-tone={tone} id={`numbers-${section}`}>
        {fold ? (
          <button
            type="button"
            className={styles.foldButton}
            aria-expanded={fold.open}
            aria-controls={`numbers-${section}-body`}
            onClick={fold.toggle}
          >
            <ChevronRight
              size={16}
              className={styles.foldChevron}
              data-open={fold.open || undefined}
              aria-hidden
            />
            {title}
          </button>
        ) : (
          title
        )}
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
      {note && <span className={styles.headingNote}>{note}</span>}
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
