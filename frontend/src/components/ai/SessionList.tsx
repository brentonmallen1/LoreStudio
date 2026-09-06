import { Pin, X } from "lucide-react";
import {
  AI_FEATURES_BY_ID,
  AI_FEATURE_GROUP_LABELS,
  type AIFeatureGroup,
} from "../../lib/ai/features.generated";
import { getSessionType } from "../../lib/ai/sessionTypes";
import { sessionLabel } from "../../lib/ai/sessionLabel";
import type { AISession } from "../../stores/aiStore";
import { useAIStore } from "../../stores/aiStore";
import styles from "./SessionList.module.css";

/** The order the panel groups sessions in (doc 06 §2.1). "system" never has sessions. */
const GROUP_ORDER: AIFeatureGroup[] = ["talk", "cast", "analyse", "explore", "prepare"];

function groupOf(session: AISession): AIFeatureGroup {
  const feature = getSessionType(session.type)?.backendFeatureId;
  return (feature && AI_FEATURES_BY_ID[feature]?.group) || "talk";
}

/** Pinned first, then most recently used. */
function order(a: AISession, b: AISession): number {
  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
  return (b.lastActiveAt ?? b.createdAt).localeCompare(a.lastActiveAt ?? a.createdAt);
}

/**
 * Open sessions, grouped the way the AI features are grouped, in place of the flat tab
 * strip that ran out of room at four tabs (doc 06 §2.1).
 */
export default function SessionList({ onPick }: { onPick: () => void }) {
  const { sessions, activeSessionId, setActiveSession, closeSession, togglePinned } = useAIStore();

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: sessions.filter((s) => groupOf(s) === group).sort(order),
  })).filter((g) => g.items.length > 0);

  if (sessions.length === 0) {
    return <p className={styles.empty}>No sessions open.</p>;
  }

  return (
    <div className={styles.list} role="listbox" aria-label="Open AI sessions">
      {grouped.map(({ group, items }) => (
        <div key={group} className={styles.group}>
          <p className={styles.groupLabel}>{AI_FEATURE_GROUP_LABELS[group]}</p>
          {items.map((session) => {
            const Icon = getSessionType(session.type)?.icon;
            const label = sessionLabel(session);
            const active = session.id === activeSessionId;
            return (
              <div key={session.id} className={`${styles.row} ${active ? styles.rowActive : ""}`}>
                <button
                  role="option"
                  aria-selected={active}
                  className={styles.rowMain}
                  onClick={() => {
                    setActiveSession(session.id);
                    onPick();
                  }}
                  title={label}
                >
                  {Icon && <Icon size={12} className={styles.rowIcon} />}
                  <span className={styles.rowLabel}>{label}</span>
                  {session.isStreaming && <span className={styles.streaming} aria-label="Streaming" />}
                </button>
                <button
                  className={`${styles.rowBtn} ${session.pinned ? styles.pinned : ""}`}
                  onClick={() => togglePinned(session.id)}
                  title={session.pinned ? "Unpin" : "Pin to the top"}
                  aria-label={session.pinned ? `Unpin ${label}` : `Pin ${label}`}
                >
                  <Pin size={11} />
                </button>
                <button
                  className={styles.rowBtn}
                  onClick={() => closeSession(session.id)}
                  title="Close session"
                  aria-label={`Close ${label}`}
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
