import { Quote, MessageCircle, AtSign, AlertCircle, Keyboard } from "lucide-react";
import { Modal } from "../common";
import { SHORTCUTS, formatCombo } from "../../lib/keyboard/shortcuts";
import styles from "./DialogueSyntaxGuide.module.css";

interface Props {
  onClose: () => void;
}

export function DialogueSyntaxContent() {
  return (
    <>
      <div className={styles.intro}>
        <p>
          LoreStudio keeps track of <strong>who says what</strong>, for the Dialogue view and the numbers on
          each voice. Tagging is optional: write naturally and most lines are worked out from the prose, or
          tag a line to be sure.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Quote size={14} />
          <span>Explicit attribution: attach speaker directly to the quote</span>
        </div>
        <p className={styles.sectionDesc}>
          Add <code>&lt;CharacterName&gt;</code> immediately after the closing quote. This ties the speaker
          directly to that specific line, unambiguous even when multiple characters are mentioned in the same
          sentence.
        </p>
        <div className={styles.exampleBox}>
          <div className={styles.exampleRaw}>
            <span className={styles.exampleLabel}>You write</span>
            <code>
              "I don't believe you."<span className={styles.mention}>&lt;Maya&gt;</span>
            </code>
            <code>
              "Why not?"<span className={styles.mention}>&lt;Thomas&gt;</span>
            </code>
            <code>
              "Because you're lying."<span className={styles.mention}>&lt;Maya&gt;</span>
            </code>
          </div>
          <div className={styles.exampleResult}>
            <span className={styles.exampleLabel}>System reads</span>
            <div>
              <span className={styles.speaker}>Maya:</span> "I don't believe you."
            </div>
            <div>
              <span className={styles.speaker}>Thomas:</span> "Why not?"
            </div>
            <div>
              <span className={styles.speaker}>Maya:</span> "Because you're lying."
            </div>
          </div>
        </div>
        <p className={styles.note}>
          Straight, curly or single quotes all work, and a space before the tag is fine:{" "}
          <code>“You shall not pass.” &lt;Lady Ashford&gt;</code>. The name can be the full one, another name
          from the character's sheet, or a short one only they go by (<code>&lt;Calder&gt;</code> for The
          Visitor (Calder)). A tag that names nobody shows in amber: point at it to correct it, add the
          character, or take the tag off.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <AtSign size={14} />
          <span>Natural prose: inferred automatically</span>
        </div>
        <p className={styles.sectionDesc}>
          A line with no tag is worked out from the prose around it: a speech tag (<code>“…,” Maya said</code>{" "}
          or <code>Maya said, “…”</code>), the one character acting in the paragraph, or an{" "}
          <code>@mention</code> nearby. No extra syntax needed.
        </p>
        <div className={styles.exampleBox}>
          <div className={styles.exampleRaw}>
            <span className={styles.exampleLabel}>You write</span>
            <code>“I don't think this will work,” Maya said, frowning.</code>
          </div>
          <div className={styles.exampleResult}>
            <span className={styles.exampleLabel}>System infers</span>
            <span className={styles.speaker}>Maya:</span> "I don't think this will work."{" "}
            <span className={styles.inferredBadge}>inferred</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <MessageCircle size={14} />
          <span>Rapid exchanges: alternation inference</span>
        </div>
        <p className={styles.sectionDesc}>
          Once two speakers are established in a paragraph, the system infers alternating dialogue for
          unattributed quotes that follow. It tracks the last two speakers and alternates between them.
        </p>
        <div className={styles.exampleBox}>
          <div className={styles.exampleRaw}>
            <span className={styles.exampleLabel}>You write</span>
            <code>
              <span className={styles.mention}>@Maya</span> turned to{" "}
              <span className={styles.mention}>@Thomas</span>.
            </code>
            <code>"I don't believe you."</code>
            <code>"Why not?"</code>
            <code>"Because you're lying."</code>
          </div>
          <div className={styles.exampleResult}>
            <span className={styles.exampleLabel}>System infers</span>
            <div>
              <span className={styles.speaker}>Maya:</span> "I don't believe you."
            </div>
            <div>
              <span className={styles.speakerAlt}>Thomas:</span> "Why not?"{" "}
              <span className={styles.inferredBadge}>inferred</span>
            </div>
            <div>
              <span className={styles.speaker}>Maya:</span> "Because you're lying."{" "}
              <span className={styles.inferredBadge}>inferred</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Keyboard size={14} />
          <span>Quick-insert shortcuts</span>
        </div>
        <div className={styles.shortcutsGrid}>
          <div className={styles.shortcutRow}>
            <kbd>^</kbd>
            <span>
              A new line for someone: pick the speaker and get <code>“”&lt;Name&gt;</code> with the cursor
              between the quotes, in the quote marks the scene already uses
            </span>
          </div>
          <div className={styles.shortcutRow}>
            <kbd>/dialogue</kbd>
            <span>
              Same as <kbd>^</kbd>
            </span>
          </div>
          <div className={styles.shortcutRow}>
            <kbd>&lt;</kbd>
            <span>
              Right after a closing quote: pick who said it, the likeliest speaker first. On an existing tag
              it replaces the name
            </span>
          </div>
          <div className={styles.shortcutRow}>
            <kbd>{formatCombo(SHORTCUTS.attributeDialogue.combo)}</kbd>
            <span>Make the selected words a line: pick the speaker, and they are quoted and tagged</span>
          </div>
          <div className={styles.shortcutRow}>
            <kbd>Tab</kbd>
            <span>
              Take the highlighted name (<kbd>Enter</kbd> does too); the rest of the top name shows faintly as
              you type. <kbd>Esc</kbd> closes the picker
            </span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <AlertCircle size={14} />
          <span>Seeing who says what</span>
        </div>
        <p className={styles.sectionDesc}>
          Turn on <strong>Highlight dialogue</strong> in the scene's ⋯ menu under Type and width. Tagged lines
          are tinted, lines worked out from the prose are underlined with a dashed line, and lines nobody
          could be found for are amber. The prose and the Dialogue view agree; a line you have just typed is
          coloured once the scene saves. To fix the amber ones, tag them, or use{" "}
          <strong>Tag the dialogue</strong> in the ⋯ menu.
        </p>
      </div>

      <div className={styles.exportNote}>
        <strong>Export:</strong> All attribution syntax is stripped automatically on export.
        <code>"Hello"&lt;Maya&gt;</code> becomes just <code>"Hello"</code> in your manuscript.
      </div>
    </>
  );
}

export default function DialogueSyntaxGuide({ onClose }: Props) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Dialogue attribution"
      icon={<Quote size={15} />}
      size="lg"
      footer={
        <button onClick={onClose} className={styles.closeBtn}>
          Close
        </button>
      }
    >
      <DialogueSyntaxContent />
    </Modal>
  );
}
