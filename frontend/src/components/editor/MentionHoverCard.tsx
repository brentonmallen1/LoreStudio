import type { RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { usePanelStore } from "../../stores/panelStore";
import type { HoverCardState } from "./useMentionHoverCard";
import styles from "./SceneEditor.module.css";

export default function MentionHoverCard({
  hover,
  cardRef,
  storyId,
}: {
  hover: HoverCardState;
  cardRef: RefObject<HTMLDivElement | null>;
  storyId?: string;
}) {
  const navigate = useNavigate();
  const openEntity = usePanelStore((s) => s.openEntity);
  const card = hover.card;
  if (!card.open) return null;
  const top = Math.max(8, card.rect.top - 12);
  const left = Math.max(8, Math.min(card.rect.left, window.innerWidth - 276));
  return (
    <div
      ref={cardRef}
      className={styles.hoverCard}
      style={{ top, left, transform: "translateY(-100%)" }}
      onMouseEnter={hover.cancelClose}
      onMouseLeave={hover.close}
    >
      {card.found ? (
        <>
          <div className={styles.hoverCardHeader}>
            <span className={styles.hoverCardName}>{card.name}</span>
            <span className={styles.hoverCardLabel}>{card.roleOrLabel}</span>
            {card.pronouns && <span className={styles.hoverCardPronouns}>{card.pronouns}</span>}
          </div>
          {card.goal || card.conflict ? (
            <dl className={styles.hoverCardPlan}>
              {card.goal && (
                <>
                  <dt>Wants</dt>
                  <dd>{card.goal}</dd>
                </>
              )}
              {card.conflict && (
                <>
                  <dt>Against</dt>
                  <dd>{card.conflict}</dd>
                </>
              )}
            </dl>
          ) : (
            card.excerpt && <p className={styles.hoverCardExcerpt}>{card.excerpt}</p>
          )}
          {storyId && (
            <div className={styles.hoverCardActions}>
              {/* Beside the page first (doc 11): the full sheet is a page away when needed. */}
              <button
                className={styles.hoverCardViewBtn}
                onClick={() => {
                  hover.close();
                  openEntity(card.type === "character" ? "character" : "location", card.entityId, card.name);
                }}
              >
                Open beside →
              </button>
              <button
                className={styles.hoverCardViewBtn}
                onClick={() => {
                  hover.close();
                  if (card.type === "character") navigate(`/stories/${storyId}/characters/${card.entityId}`);
                  else navigate(`/stories/${storyId}/locations/${card.entityId}`);
                }}
              >
                Full sheet
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.hoverCardNotFound}>
          <span className={styles.hoverCardMissingName}>{card.name}</span>
          <span className={styles.hoverCardNotFoundBadge}>Not found</span>
        </div>
      )}
    </div>
  );
}
