import { AlertTriangle } from "lucide-react";
import type { CharacterRelationship, Character } from "../../../types";
import styles from "./ValidationWarnings.module.css";

interface Warning {
  id: string;
  message: string;
}

interface Props {
  relationships: CharacterRelationship[];
  characters: Character[];
  currentCharacterId: string;
}

export default function ValidationWarnings({ relationships, characters, currentCharacterId }: Props) {
  const warnings: Warning[] = [];

  // Relationships without narrative purpose
  const noPurpose = relationships.filter((r) => !r.narrative_purpose?.length);
  if (noPurpose.length > 0) {
    warnings.push({
      id: "no-purpose",
      message: `${noPurpose.length} relationship${noPurpose.length > 1 ? "s have" : " has"} no narrative purpose defined.`,
    });
  }

  // Characters with no outgoing or incoming relationships
  const connectedIds = new Set<string>();
  relationships.forEach((r) => { connectedIds.add(r.character_id); connectedIds.add(r.related_character_id); });
  const isolated = characters.filter((c) => c.id !== currentCharacterId && !connectedIds.has(c.id));
  if (isolated.length > 0) {
    const names = isolated.slice(0, 3).map((c) => c.name).join(", ");
    warnings.push({
      id: "isolated",
      message: `${isolated.length > 3 ? `${isolated.length} characters` : names} ${isolated.length === 1 ? "has" : "have"} no relationships in this story.`,
    });
  }

  if (warnings.length === 0) return null;

  return (
    <div className={styles.root}>
      <AlertTriangle size={13} className={styles.icon} />
      <div className={styles.list}>
        {warnings.map((w) => (
          <span key={w.id} className={styles.warning}>{w.message}</span>
        ))}
      </div>
    </div>
  );
}
