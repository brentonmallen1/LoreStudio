import { EyeOff, Trash2, Check } from "lucide-react";
import type { CharacterRelationship, Character } from "../../../types";
import { STRENGTH_DIMS } from "./StrengthSliders";
import styles from "./RelationshipCard.module.css";

interface Props {
  relationship: CharacterRelationship;
  targetCharacter: Character | undefined;
  onClick: () => void;
  onDelete: () => void;
  onAccept?: () => void;
}

function BipolarBar({ dim, value }: { dim: typeof STRENGTH_DIMS[0]; value: number }) {
  const stored  = Number(value) || 5;
  const display = stored - 5; // −5..+5
  const pctL    = stored < 5 ? ((5 - stored) / 5) * 100 : 0;
  const pctR    = stored > 5 ? ((stored - 5) / 5) * 100 : 0;
  const sign    = display > 0 ? "+" : "";
  const tooltip = `${dim.label}: ${sign}${display}  (${dim.negLabel} ← 0 → ${dim.posLabel})`;

  return (
    <div className={styles.strengthRow} title={tooltip}>
      <span className={styles.strengthLabel}>{dim.key[0].toUpperCase()}</span>
      <div className={styles.bpWrap}>
        <div className={styles.bpLeft}>
          <div className={styles.bpFillLeft} style={{ width: `${pctL}%`, background: dim.color, opacity: 0.55 }} />
        </div>
        <div className={styles.bpTick} />
        <div className={styles.bpRight}>
          <div className={styles.bpFillRight} style={{ width: `${pctR}%`, background: dim.color }} />
        </div>
      </div>
      <span className={styles.strengthValue} style={{ color: display < 0 ? "#a06090" : display > 0 ? "#609878" : undefined }}>
        {sign}{display}
      </span>
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function RelationshipCard({ relationship, targetCharacter, onClick, onDelete, onAccept }: Props) {
  const isSuggested = relationship.is_suggested;
  const s = relationship.strength as unknown as Record<string, number> | null | undefined;

  return (
    <div
      className={`${styles.card} ${isSuggested ? styles.suggested : ""}`}
      onClick={onClick}
    >
      {/* Suggestion ribbon */}
      {isSuggested && (
        <div className={styles.suggestionBadge} style={{ background: "var(--color-ai-subtle)", borderColor: "var(--color-ai-border)" }}>
          <span className={styles.suggestionLabel}>AI Suggestion</span>
          {onAccept && (
            <button
              className={styles.acceptBtn}
              onClick={(e) => { e.stopPropagation(); onAccept(); }}
              title="Accept suggestion"
            >
              <Check size={11} />
            </button>
          )}
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.avatar}>
          {targetCharacter ? initials(targetCharacter.name) : "?"}
        </div>
        <div className={styles.info}>
          <span className={styles.name}>{targetCharacter?.name ?? "Unknown character"}</span>
          <span className={styles.type}>{relationship.relationship_type}</span>
        </div>
        <div className={styles.icons}>
          {relationship.visibility === "hidden" && (
            <span title="Hidden relationship"><EyeOff size={12} className={styles.hiddenIcon} /></span>
          )}
          <button
            className={styles.deleteBtn}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete relationship"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Strength dimensions */}
      <div className={styles.strengthBars}>
        {STRENGTH_DIMS.map((dim) => (
          <BipolarBar key={dim.key} dim={dim} value={s?.[dim.key] ?? 5} />
        ))}
      </div>

      {/* Narrative purposes */}
      {relationship.narrative_purpose?.length > 0 && (
        <div className={styles.tags}>
          {relationship.narrative_purpose.slice(0, 3).map((p) => (
            <span key={p} className={styles.tag}>{p}</span>
          ))}
          {relationship.narrative_purpose.length > 3 && (
            <span className={styles.tagMore}>+{relationship.narrative_purpose.length - 3}</span>
          )}
        </div>
      )}

      {relationship.description && (
        <p className={styles.description}>{relationship.description}</p>
      )}
    </div>
  );
}
