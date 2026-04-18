import { BookOpen, MapPin, HelpCircle, User, Zap } from "lucide-react";
import { Modal } from "../common";
import CollapsibleSection from "../common/CollapsibleSection";
import styles from "./MICEGuide.module.css";

interface Props {
  onClose: () => void;
}

const MICE_TYPES = [
  {
    key: "milieu",
    label: "Milieu",
    icon: <MapPin size={14} />,
    tagline: "A stranger enters a strange land",
    opens: "Character enters an unfamiliar place or situation",
    closes: "Character leaves, returns home, or fully adapts",
    examples: ["Portal fantasy", "Fish-out-of-water", "Road trip stories", "Exile narratives"],
    note: "Reader satisfaction comes from the return or resolution of the displacement.",
  },
  {
    key: "idea",
    label: "Idea",
    icon: <HelpCircle size={14} />,
    tagline: "A question demands an answer",
    opens: "A question is raised — who did it? what is happening? what does this mean?",
    closes: "The question is answered",
    examples: ["Mystery", "Thriller", "Puzzle stories", "Whodunits"],
    note: "Every unanswered question is a promise to the reader. Answer them.",
  },
  {
    key: "character",
    label: "Character",
    icon: <User size={14} />,
    tagline: "Someone wants to change",
    opens: "Character is dissatisfied with themselves, their role, or their identity",
    closes: "Character accepts who they are or transforms into someone new",
    examples: ["Coming-of-age", "Redemption arcs", "Identity stories", "Grief journeys"],
    note: "The external plot is the pressure that forces the internal change.",
  },
  {
    key: "event",
    label: "Event",
    icon: <Zap size={14} />,
    tagline: "The world is out of balance",
    opens: "The status quo is disrupted — a disaster, an invasion, a revelation",
    closes: "A new equilibrium is established (not necessarily the old one)",
    examples: ["Disaster stories", "Revolutions", "Power vacuums", "Upheaval narratives"],
    note: "The new equilibrium doesn't have to be better — just stable.",
  },
];

export function MICEContent() {
  return (
    <>
    <div className={styles.intro}>
        <p>
          The <strong>MICE Quotient</strong> is a framework for understanding what kind of story you're telling —
          and when it's over. Every story thread belongs to one of four types. Tagging your threads helps you
          ensure every question you open gets answered, and that nested threads close in the right order.
        </p>
        <p className={styles.credit}>
          Developed by Orson Scott Card, popularized for short fiction by Mary Robinette Kowal.
        </p>
      </div>

      <div className={styles.typesGrid}>
        {MICE_TYPES.map((t) => (
          <div key={t.key} className={`${styles.typeCard} ${styles[t.key]}`}>
            <div className={styles.typeHeader}>
              <span className={styles.typeIcon}>{t.icon}</span>
              <span className={styles.typeLabel}>{t.label}</span>
            </div>
            <p className={styles.typeTagline}>"{t.tagline}"</p>
            <div className={styles.typeDetail}>
              <div className={styles.typeRow}>
                <span className={styles.typeRowLabel}>Opens:</span>
                <span>{t.opens}</span>
              </div>
              <div className={styles.typeRow}>
                <span className={styles.typeRowLabel}>Closes:</span>
                <span>{t.closes}</span>
              </div>
            </div>
            <div className={styles.examples}>
              {t.examples.map((ex) => (
                <span key={ex} className={styles.examplePill}>{ex}</span>
              ))}
            </div>
            <p className={styles.typeNote}>{t.note}</p>
          </div>
        ))}
      </div>

      <div className={styles.sections}>
        <CollapsibleSection title="Nesting Rules (LIFO)" defaultOpen>
          <div className={styles.sectionContent}>
            <p>
              When you open multiple MICE threads in a story, they must close in <strong>reverse order</strong> —
              last opened, first closed. This is sometimes called the "LIFO" rule (Last In, First Out).
            </p>
            <p>
              Readers hold open threads in their heads like a mental stack. Crossing threads — where an inner
              thread outlasts an outer one — creates a feeling of structural instability, even if readers can't
              name why.
            </p>
            <div className={styles.nestingDiagram}>
              <div className={styles.diagramLabel}>Correct nesting:</div>
              <div className={styles.diagramTrack}>
                <div className={`${styles.diagramBar} ${styles.barA}`}>
                  <span>Thread A (opens first)</span>
                </div>
                <div className={`${styles.diagramBar} ${styles.barB}`}>
                  <span>Thread B (opens second, closes first)</span>
                </div>
                <div className={styles.diagramArrows}>
                  <span>A opens → B opens → B closes → A closes ✓</span>
                </div>
              </div>
              <div className={styles.diagramLabel} style={{ marginTop: "0.75rem" }}>Broken nesting:</div>
              <div className={styles.diagramTrack}>
                <div className={`${styles.diagramBar} ${styles.barA}`}>
                  <span>Thread A ←——————————————→</span>
                </div>
                <div className={`${styles.diagramBarBroken} ${styles.barB}`}>
                  <span>Thread B ←————————————————————→ ✗ closes after A</span>
                </div>
              </div>
            </div>
            <p className={styles.tip}>
              <strong>Tip:</strong> Short stories usually have 1-2 threads. Each additional thread requires more
              word count to open and close cleanly — this is why flash fiction almost always has a single MICE element.
            </p>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Short Fiction Economy">
          <div className={styles.sectionContent}>
            <p>
              Short fiction is ruthless about scope. Every element must earn its place — there is no room for
              setup that doesn't pay off within the word budget.
            </p>
            <table className={styles.economyTable}>
              <thead>
                <tr>
                  <th>Form</th>
                  <th>Word Count</th>
                  <th>Typical MICE Threads</th>
                  <th>Subplots</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Flash fiction</td>
                  <td>&lt;1,000</td>
                  <td>1</td>
                  <td>None</td>
                </tr>
                <tr>
                  <td>Short story</td>
                  <td>1K–7.5K</td>
                  <td>1–2</td>
                  <td>At most 1, tightly woven</td>
                </tr>
                <tr>
                  <td>Novelette</td>
                  <td>7.5K–17.5K</td>
                  <td>2–3</td>
                  <td>1–2 if essential</td>
                </tr>
                <tr>
                  <td>Novella</td>
                  <td>17.5K–40K</td>
                  <td>3–4</td>
                  <td>2–3</td>
                </tr>
              </tbody>
            </table>
            <p className={styles.tip}>
              <strong>Scene economy test:</strong> For each scene, ask "which MICE thread does this serve?" If
              a scene doesn't advance at least one open thread, it's a candidate for cutting.
            </p>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Try/Fail Cycles">
          <div className={styles.sectionContent}>
            <p>
              Before a protagonist resolves a MICE thread, they should try and fail at least once — often two
              or three times. Each failure raises the stakes and earns the eventual resolution.
            </p>
            <div className={styles.outcomesGrid}>
              <div className={styles.outcomeCard}>
                <div className={`${styles.outcomeBadge} ${styles.outcomeDisaster}`}>Fail — Disaster</div>
                <p>The attempt fails <em>and makes things worse</em>. New problems are created.</p>
              </div>
              <div className={styles.outcomeCard}>
                <div className={`${styles.outcomeBadge} ${styles.outcomeSetback}`}>Fail — Setback</div>
                <p>The attempt fails but doesn't worsen the situation. A dead end, not a catastrophe.</p>
              </div>
              <div className={styles.outcomeCard}>
                <div className={`${styles.outcomeBadge} ${styles.outcomeSuccessCost}`}>Success — With Cost</div>
                <p>The attempt succeeds but at a price — something lost, sacrificed, or damaged.</p>
              </div>
              <div className={styles.outcomeCard}>
                <div className={`${styles.outcomeBadge} ${styles.outcomeClean}`}>Success — Clean</div>
                <p>The attempt succeeds without significant cost. Best saved for the final resolution.</p>
              </div>
            </div>
            <p className={styles.tip}>
              <strong>Guideline:</strong> Short stories often use 2–3 try/fail cycles before the climax.
              Ending with a "clean success" on the first attempt usually means the story isn't using its full
              potential for tension.
            </p>
          </div>
        </CollapsibleSection>
      </div>
    </>
  );
}

export default function MICEGuide({ onClose }: Props) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="The MICE Quotient"
      icon={<BookOpen size={15} />}
      size="lg"
      footer={<button onClick={onClose} className={styles.closeBtn}>Close</button>}
    >
      <MICEContent />
    </Modal>
  );
}
