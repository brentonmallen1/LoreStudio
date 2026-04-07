import { Quote, MessageCircle, AtSign, AlertCircle, Keyboard } from "lucide-react";
import { Modal } from "../common";
import styles from "./DialogueSyntaxGuide.module.css";

interface Props {
  onClose: () => void;
}

export default function DialogueSyntaxGuide({ onClose }: Props) {
  const footer = (
    <button onClick={onClose} className={styles.closeBtn}>
      Close
    </button>
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Dialogue Attribution"
      icon={<Quote size={15} />}
      size="lg"
      footer={footer}
    >
      <div className={styles.intro}>
        <p>
          LoreStudio can track <strong>who says what</strong> across your story — enabling dialogue stats,
          character voice analysis, and future audio playback. Attribution is always optional: write
          naturally and the system will do its best to infer speakers, or use explicit syntax for precision.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Quote size={14} />
          <span>Explicit attribution — attach speaker directly to the quote</span>
        </div>
        <p className={styles.sectionDesc}>
          Add <code>&lt;CharacterName&gt;</code> immediately after the closing quote. This ties the
          speaker directly to that specific line — unambiguous even when multiple characters are mentioned in the same sentence.
        </p>
        <div className={styles.exampleBox}>
          <div className={styles.exampleRaw}>
            <span className={styles.exampleLabel}>You write</span>
            <code>"I don't believe you."<span className={styles.mention}>&lt;Maya&gt;</span></code>
            <code>"Why not?"<span className={styles.mention}>&lt;Thomas&gt;</span></code>
            <code>"Because you're lying."<span className={styles.mention}>&lt;Maya&gt;</span></code>
          </div>
          <div className={styles.exampleResult}>
            <span className={styles.exampleLabel}>System reads</span>
            <div><span className={styles.speaker}>Maya:</span> "I don't believe you."</div>
            <div><span className={styles.speaker}>Thomas:</span> "Why not?"</div>
            <div><span className={styles.speaker}>Maya:</span> "Because you're lying."</div>
          </div>
        </div>
        <p className={styles.note}>
          Multi-word names work: <code>"You shall not pass."&lt;Lady Ashford&gt;</code>
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <AtSign size={14} />
          <span>Natural prose — inferred automatically</span>
        </div>
        <p className={styles.sectionDesc}>
          If you use <code>@CharacterName</code> mentions in prose, the system still detects nearby
          quoted text and attributes it. No extra syntax needed for natural writing.
        </p>
        <div className={styles.exampleBox}>
          <div className={styles.exampleRaw}>
            <span className={styles.exampleLabel}>You write</span>
            <code>"I don't think this will work," <span className={styles.mention}>@Maya</span> said, frowning.</code>
          </div>
          <div className={styles.exampleResult}>
            <span className={styles.exampleLabel}>System infers</span>
            <span className={styles.speaker}>Maya:</span> "I don't think this will work." <span className={styles.inferredBadge}>inferred</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <MessageCircle size={14} />
          <span>Rapid exchanges — alternation inference</span>
        </div>
        <p className={styles.sectionDesc}>
          Once two speakers are established in a paragraph, the system infers alternating dialogue
          for unattributed quotes that follow. It tracks the last two speakers and alternates between them.
        </p>
        <div className={styles.exampleBox}>
          <div className={styles.exampleRaw}>
            <span className={styles.exampleLabel}>You write</span>
            <code><span className={styles.mention}>@Maya</span> turned to <span className={styles.mention}>@Thomas</span>.</code>
            <code>"I don't believe you."</code>
            <code>"Why not?"</code>
            <code>"Because you're lying."</code>
          </div>
          <div className={styles.exampleResult}>
            <span className={styles.exampleLabel}>System infers</span>
            <div><span className={styles.speaker}>Maya:</span> "I don't believe you."</div>
            <div><span className={styles.speakerAlt}>Thomas:</span> "Why not?" <span className={styles.inferredBadge}>inferred</span></div>
            <div><span className={styles.speaker}>Maya:</span> "Because you're lying." <span className={styles.inferredBadge}>inferred</span></div>
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
            <span>Open speaker picker — inserts <code>""&lt;Name&gt;</code> with cursor between quotes</span>
          </div>
          <div className={styles.shortcutRow}>
            <kbd>/dialogue</kbd>
            <span>Same as <kbd>^</kbd> — type at start of a line to pick a speaker</span>
          </div>
          <div className={styles.shortcutRow}>
            <kbd>⌘⇧D</kbd>
            <span>Select quoted text first, then wrap it: <code>"selected"&lt;Name&gt;</code></span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <AlertCircle size={14} />
          <span>Unattributed dialogue</span>
        </div>
        <p className={styles.sectionDesc}>
          Quotes with no nearby <code>@mention</code> are marked as unattributed with a subtle amber
          underline. They still appear in dialogue stats as "Unknown". You can fix them by clicking
          the quote and editing the speaker, or by adding explicit <code>@Name: "..."</code> syntax.
        </p>
      </div>

      <div className={styles.exportNote}>
        <strong>Export:</strong> All attribution syntax is stripped automatically on export.
        <code>"Hello"&lt;Maya&gt;</code> becomes just <code>"Hello"</code> in your manuscript.
      </div>
    </Modal>
  );
}
