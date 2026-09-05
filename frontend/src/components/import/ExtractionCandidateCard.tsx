import { User, MapPin, Link2, CheckSquare, Square } from "lucide-react";
import type { ExtractionCandidate } from "../../types";
import styles from "./EntityExtractionStep.module.css";

interface Props {
  candidate: ExtractionCandidate;
  selected: boolean;
  onToggle: (id: string) => void;
}

const ENTITY_ICONS = {
  character: User,
  location: MapPin,
  relationship: Link2,
} as const;

function ConfidenceDots({ value }: { value: number }) {
  const filled = Math.round(value * 5);
  return (
    <span className={styles.confidenceDots} title={`Confidence: ${Math.round(value * 100)}%`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < filled ? styles.dotFilled : styles.dotEmpty} />
      ))}
    </span>
  );
}

function ExtractedDetails({ candidate }: { candidate: ExtractionCandidate }) {
  const char = candidate.extracted_character;
  const loc = candidate.extracted_location;
  const rel = candidate.extracted_relationship;

  if (char) {
    const details = [char.personality, char.motivation, char.appearance, char.background]
      .filter(Boolean)
      .slice(0, 2)
      .join(" · ");
    if (!details && !char.role) return null;
    return (
      <div className={styles.candidateDetail}>
        {char.role && <span className={styles.roleTag}>{char.role}</span>}
        {details && <span className={styles.detailText}>{details}</span>}
      </div>
    );
  }

  if (loc) {
    const details = [loc.description, loc.atmosphere].filter(Boolean).slice(0, 1).join("");
    if (!details && !loc.location_type) return null;
    return (
      <div className={styles.candidateDetail}>
        {loc.location_type && <span className={styles.roleTag}>{loc.location_type.replace("_", " ")}</span>}
        {details && <span className={styles.detailText}>{details}</span>}
      </div>
    );
  }

  if (rel) {
    const details = [rel.description, rel.role_influence].filter(Boolean).join(" · ");
    return (
      <div className={styles.candidateDetail}>
        {rel.relationship_type && <span className={styles.roleTag}>{rel.relationship_type}</span>}
        {details && <span className={styles.detailText}>{details}</span>}
      </div>
    );
  }

  return null;
}

export default function ExtractionCandidateCard({ candidate, selected, onToggle }: Props) {
  const Icon = ENTITY_ICONS[candidate.entity_type];
  const isAiEnriched = candidate.source === "ai";

  return (
    <button
      className={`${styles.candidateCard} ${selected ? styles.candidateSelected : ""}`}
      style={
        {
          "--candidate-color": isAiEnriched ? "var(--color-ai)" : "var(--color-nlp)",
        } as React.CSSProperties
      }
      onClick={() => onToggle(candidate.id)}
    >
      <div className={styles.candidateCheckbox}>
        {selected ? (
          <CheckSquare size={15} style={{ color: "var(--candidate-color)" }} />
        ) : (
          <Square size={15} style={{ color: "var(--color-text-muted)" }} />
        )}
      </div>

      <div className={styles.candidateIcon} style={{ color: "var(--candidate-color)" }}>
        <Icon size={14} />
      </div>

      <div className={styles.candidateBody}>
        <div className={styles.candidateName}>{candidate.name}</div>
        <ExtractedDetails candidate={candidate} />
      </div>

      <div className={styles.candidateMeta}>
        <ConfidenceDots value={candidate.confidence} />
        <span className={styles.occurrenceCount}>{candidate.occurrences}×</span>
        <span
          className={styles.sourceTag}
          style={{ color: isAiEnriched ? "var(--color-ai)" : "var(--color-nlp)" }}
        >
          {isAiEnriched ? "AI" : "NLP"}
        </span>
      </div>
    </button>
  );
}
