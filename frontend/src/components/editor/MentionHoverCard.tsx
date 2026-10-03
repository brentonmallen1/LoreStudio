import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { usePanelStore } from "../../stores/panelStore";
import type { HoverCardState } from "./useMentionHoverCard";
import MentionFixer from "./MentionFixer";
import styles from "./SceneEditor.module.css";

export default function MentionHoverCard({
  hover,
  cardRef,
  storyId,
  onUnlink,
  onRetag,
}: {
  hover: HoverCardState;
  cardRef: RefObject<HTMLDivElement | null>;
  storyId?: string;
  /** Drop the syntax of a mention (or a speaker tag) that names nobody, keeping its words. */
  onUnlink?: (type: "character" | "setting", name: string, speakerTag: boolean) => void;
  /** Correct a speaker tag that names nobody to a character's name. */
  onRetag?: (written: string, name: string) => void;
}) {
  const navigate = useNavigate();
  const openEntity = usePanelStore((s) => s.openEntity);
  const card = hover.card;
  // A click inside keeps the card open (choosing who a mention means takes more than a
  // glance); it then closes on Escape or a click elsewhere.
  // Held by the card itself, so a card opened again later starts unpinned.
  const [pinned, setPinned] = useState<object | null>(null);
  const isPinned = card.open && pinned === card;
  const key = card.open ? `${card.type}:${card.name}` : undefined;
  const { close } = hover;
  useEffect(() => {
    if (!isPinned) return;
    function onDown(e: MouseEvent) {
      if (!cardRef.current?.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isPinned, cardRef, close]);
  if (!card.open) return null;
  // Above the words, or below them when they sit near the top of the window.
  const below = card.rect.top < 280;
  const top = below ? card.rect.bottom + 8 : Math.max(8, card.rect.top - 12);
  const left = Math.max(8, Math.min(card.rect.left, window.innerWidth - 276));
  // Portalled: the editor's container is a size container, which would make it the box a
  // fixed card is placed in and clip it (doc 13 P2).
  return createPortal(
    <div
      ref={cardRef}
      className={styles.hoverCard}
      style={{ top, left, transform: below ? undefined : "translateY(-100%)" }}
      onMouseEnter={hover.cancelClose}
      onMouseLeave={() => !isPinned && hover.close()}
      onMouseDown={() => setPinned(card)}
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
                  if (card.type === "character")
                    navigate(`/stories/${storyId}/lorebook/characters/${card.entityId}`);
                  else navigate(`/stories/${storyId}/lorebook/places/${card.entityId}`);
                }}
              >
                Full sheet
              </button>
            </div>
          )}
        </>
      ) : storyId ? (
        <MentionFixer
          key={key}
          type={card.type}
          name={card.name}
          storyId={storyId}
          speakerTag={!!card.speakerTag}
          onUnlink={onUnlink && (() => onUnlink(card.type, card.name, !!card.speakerTag))}
          onRetag={onRetag && ((name) => onRetag(card.name, name))}
          onDone={hover.close}
        />
      ) : null}
    </div>,
    document.body,
  );
}
