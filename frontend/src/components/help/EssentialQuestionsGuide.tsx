import { BookOpen, User, Target, Heart, Swords, Flame, Compass } from "lucide-react";
import { Modal } from "../common";
import CollapsibleSection from "../common/CollapsibleSection";
import styles from "./EssentialQuestionsGuide.module.css";

interface Props {
  onClose: () => void;
}

const QUESTIONS = [
  {
    key: "protagonist",
    number: 1,
    label: "Who is the protagonist?",
    icon: <User size={14} />,
    tagline: "The reader needs a someone to follow",
    meaning:
      "A clear protagonist anchors the reader's attention and emotional investment. Without knowing who the story is about, nothing else can land.",
    inLoreStudio:
      'Character role, name, and presence in scenes. A character with role "protagonist" and a defined profile.',
    hint: "If someone picked up your story mid-page, would they immediately know whose story this is?",
  },
  {
    key: "want",
    number: 2,
    label: "What do they want?",
    icon: <Target size={14} />,
    tagline: "The desire line drives every scene",
    meaning:
      "The external goal: the concrete thing the protagonist is actively pursuing. It creates forward momentum and gives readers something to root for or against.",
    inLoreStudio:
      "Character mission statement, story goals, and what the protagonist is shown doing in scenes.",
    hint: 'Can you state their want in one sentence? "[Character] wants to [do/get/achieve X]."',
  },
  {
    key: "why",
    number: 3,
    label: "Why do they want it?",
    icon: <Heart size={14} />,
    tagline: "Motivation is what makes readers care",
    meaning:
      "The internal motivation: the emotional or psychological reason behind the external goal. This is what transforms a plot into a story.",
    inLoreStudio:
      "Character motivation field, background, and narrative intent. The deeper reason behind the mission statement.",
    hint: "If the external goal is getting the job, the internal why might be proving self-worth. The why survives even if the want changes.",
  },
  {
    key: "obstacle",
    number: 4,
    label: "What's stopping them?",
    icon: <Swords size={14} />,
    tagline: "Conflict creates story",
    meaning:
      "The opposing force: a character, a system, an internal flaw, a circumstance. Without meaningful opposition, the protagonist simply gets what they want, and there's no story.",
    inLoreStudio:
      "Story central conflict, antagonist characters, plot threads, and try/fail cycles in scenes.",
    hint: "The best obstacles are specific and personal. A villain who specifically threatens what the protagonist most values is far more effective than a generic threat.",
  },
  {
    key: "stakes",
    number: 5,
    label: "What's at stake if they fail?",
    icon: <Flame size={14} />,
    tagline: "Stakes create urgency",
    meaning:
      "The consequences of failure: what the protagonist stands to lose if they don't succeed. Stakes give the reader a reason to stay tense, and they must be real enough to believe.",
    inLoreStudio:
      "Story narrative intent, goals with completion status, and what the central conflict threatens.",
    hint: "Stakes work at multiple levels: external (they lose the house), internal (they lose their sense of self), and interpersonal (they lose the relationship). The strongest stories have all three.",
  },
  {
    key: "change",
    number: 6,
    label: "How do they change?",
    icon: <Compass size={14} />,
    tagline: "The arc is why the story matters",
    meaning:
      "The transformation: how the protagonist is fundamentally different by the end. This doesn't require redemption or growth: a tragedy is a change toward something worse. But something must shift.",
    inLoreStudio:
      "Character arc notes, arc milestones, and narrative intent. What the author intends for this character to become.",
    hint: "A character who ends up exactly where they started, unchanged, usually means the story hasn't done its work, unless the point is that they refused to change (which is itself a statement).",
  },
];

export function EssentialQuestionsContent() {
  return (
    <>
      <div className={styles.intro}>
        <p>
          Before a story can work, six fundamental questions need answers. They don't all need to be resolved
          on the page (some live in the author's notes, some in subtext), but they need to exist somewhere.
          When any one is missing or unclear, readers feel it, even if they can't name why.
        </p>
        <p>
          Use the <strong>Story Compass</strong> tool on the Health page to check whether these questions are
          answerable for any character in your story.
        </p>
      </div>

      <div className={styles.questionsGrid}>
        {QUESTIONS.map((q) => (
          <div key={q.key} className={styles.questionCard}>
            <div className={styles.questionHeader}>
              <span className={styles.questionNumber}>{q.number}</span>
              <span className={styles.questionIcon}>{q.icon}</span>
              <span className={styles.questionLabel}>{q.label}</span>
            </div>
            <p className={styles.questionTagline}>"{q.tagline}"</p>
            <p className={styles.questionMeaning}>{q.meaning}</p>
            <div className={styles.questionMeta}>
              <span className={styles.metaLabel}>In LoreStudio:</span>
              <span className={styles.metaValue}>{q.inLoreStudio}</span>
            </div>
            <p className={styles.questionHint}>{q.hint}</p>
          </div>
        ))}
      </div>

      <div className={styles.sections}>
        <CollapsibleSection title="Working with multiple protagonists">
          <div className={styles.sectionContent}>
            <p>
              When a story has multiple main characters, each protagonist needs their own answers to all six
              questions. They don't need to be different answers (two characters can want the same thing for
              different reasons), but each character's version must be clear.
            </p>
            <p>
              In LoreStudio, mark multiple characters with the role <strong>protagonist</strong>. The Story
              Compass lets you select which character to analyze so you can check each one independently.
            </p>
            <p className={styles.tip}>
              <strong>Common problem:</strong> In ensemble casts, stakes often get diffuse: each character has
              mild consequences for failure. Consider whether each protagonist has something genuinely
              irreplaceable to lose.
            </p>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="How these questions relate to MICE">
          <div className={styles.sectionContent}>
            <p>
              The 6 Essential Questions and the MICE Quotient work at different levels. MICE describes the{" "}
              <em>shape</em> of story threads: what opens and closes them. The 6 Questions describe the{" "}
              <em>engine</em>: what makes the protagonist's journey meaningful.
            </p>
            <p>
              A Character MICE thread typically maps directly to questions 3 and 6: Why do they want to
              change? How do they change? An Event thread maps more to questions 4 and 5: what's disrupting
              the world, and what's at stake in restoring balance?
            </p>
            <p className={styles.tip}>
              <strong>Tip:</strong> If your dominant MICE thread is Milieu or Idea but you're struggling with
              reader connection, check questions 3 and 6. External-world stories often neglect the internal
              stakes.
            </p>
          </div>
        </CollapsibleSection>
      </div>
    </>
  );
}

export default function EssentialQuestionsGuide({ onClose }: Props) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="The 6 Essential Questions"
      icon={<BookOpen size={15} />}
      size="lg"
      footer={
        <button onClick={onClose} className={styles.closeBtn}>
          Close
        </button>
      }
    >
      <EssentialQuestionsContent />
    </Modal>
  );
}
