import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Modal } from "../../common";
import styles from "./WhoAreThey.module.css";

export interface About {
  /** Each part a heading and its paragraphs: what it is, why it is here, how to read it. */
  parts: [string, string[]][];
}

/** A block's title on the character sheet, with an ⓘ that says what the block is for. */
export default function BlockHeading({
  id,
  title,
  about,
  note,
}: {
  id: string;
  title: string;
  about?: About;
  note?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.blockHead}>
      <h3 id={id} className={styles.blockTitle}>
        {title}
      </h3>
      {about && (
        <>
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
              {about.parts.map(([heading, paragraphs]) => (
                <section key={heading}>
                  <h3>{heading}</h3>
                  {paragraphs.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </section>
              ))}
            </div>
          </Modal>
        </>
      )}
      {note && <span className={styles.blockNote}>{note}</span>}
    </div>
  );
}
