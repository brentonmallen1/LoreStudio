import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, FileInput, GitBranch, Lightbulb, MapPin, MessageSquareQuote, User } from "lucide-react";
import type { Proposal, ProposalKind } from "../../types/proposals";
import SameAsPicker from "../lorebook/SameAsPicker";
import styles from "../findings/Findings.module.css";

export const KIND_ICONS: Record<ProposalKind, typeof User> = {
  person: User,
  place: MapPin,
  dialogue: MessageSquareQuote,
  fact: Lightbulb,
  presence: Eye,
  relationship: GitBranch,
  imported: FileInput,
};

/** An imported item's text can run long: the start, and the rest on request. */
const EXCERPT = 240;

/**
 * One proposal (doc 12 P5): what was noticed, the words it came from, where, and a yes
 * and a no. The same row as a finding, so the two inboxes read alike.
 */
export default function ProposalRow({
  proposal: p,
  storyId,
  onAct,
  onDecline,
  onMerged,
}: {
  proposal: Proposal;
  storyId: string;
  onAct: (p: Proposal, action: string) => Promise<void>;
  onDecline: (p: Proposal) => Promise<void>;
  /** After "Same as…" folded a found place into another. */
  onMerged?: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [whole, setWhole] = useState(false);
  const Icon = KIND_ICONS[p.kind];
  // An import's leftovers have many homes: the first as a button, the rest in a picker.
  const imported = p.kind === "imported";
  const buttons = imported ? p.actions.filter((a) => a.primary) : p.actions;
  const others = imported ? p.actions.filter((a) => !a.primary) : [];
  const long = imported && p.evidence.length > EXCERPT;
  const evidence = long && !whole ? `${p.evidence.slice(0, EXCERPT).trimEnd()}…` : p.evidence;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.row}>
      <Icon size={14} className={styles.kindIcon} aria-hidden />
      <div className={styles.body}>
        <span className={styles.text}>{p.text}</span>
        {p.evidence &&
          (imported ? (
            <span className={styles.quote} data-imported>
              {evidence}
              {long && (
                <button type="button" className={styles.inlineLink} onClick={() => setWhole(!whole)}>
                  {whole ? "Show less" : "Show all"}
                </button>
              )}
            </span>
          ) : (
            <span className={styles.quote}>“{p.evidence}”</span>
          ))}
        {p.where &&
          (p.node_id ? (
            <Link className={styles.whereLink} to={`/stories/${storyId}/write/${p.node_id}`}>
              {p.where}
            </Link>
          ) : (
            <span className={styles.where}>{p.where}</span>
          ))}
      </div>
      {!imported && (
        <span className={styles.source} data-source={p.source}>
          {p.source === "ai" ? "Assistant" : "Local"}
        </span>
      )}
      {buttons.map((a) => (
        <button
          key={a.id}
          type="button"
          className={a.primary ? styles.yes : styles.verb}
          disabled={busy}
          onClick={() => void run(() => onAct(p, a.id))}
        >
          {a.label}
        </button>
      ))}
      {others.length > 0 && (
        <select
          className={styles.verb}
          aria-label={`Make ${p.subject} into`}
          value=""
          disabled={busy}
          onChange={(e) => e.target.value && void run(() => onAct(p, e.target.value))}
        >
          <option value="">Make into…</option>
          {others.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label.replace(/^Make an? /, "")}
            </option>
          ))}
        </select>
      )}
      {p.id.startsWith("stub:") && (
        <SameAsPicker
          stubId={p.id.slice("stub:".length)}
          className={styles.verb}
          onMerged={() => void onMerged?.()}
        />
      )}
      <button
        type="button"
        className={styles.no}
        disabled={busy}
        onClick={() => void run(() => onDecline(p))}
      >
        {p.decline}
      </button>
    </div>
  );
}
