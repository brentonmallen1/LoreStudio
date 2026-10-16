import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { glossaryEntry, glossaryHref, type TermId } from "../../lib/glossary";
import { noteOpened, noteShown, useIsNewTerm } from "../../lib/glossary/seen";
import { useMode } from "../../lib/mode";
import { navigateTo } from "../../lib/navigation";
import InlineText from "./InlineText";
import styles from "./Term.module.css";

const GAP = 6;
const MARGIN = 12;

/**
 * A word that explains itself (doc 30 D1): a dotted underline that opens a popover with the
 * plain definition, an example from The Last Lighthouse, what else it is called, and a link to
 * its glossary entry. The first time a writer meets a word it also wears a small (?).
 *
 * The definitions are `lib/glossary`, the same entries the Glossary guide draws, so the
 * popover and the guide never disagree. A Studio-only word in Writer mode is plain text.
 */
export default function Term({ id, children }: { id: TermId; children?: ReactNode }) {
  const entry = glossaryEntry(id);
  const mode = useMode();
  const fresh = useIsNewTerm(id);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const popId = useId();
  const shown = Boolean(entry && (mode === "studio" || !entry.studio));

  useEffect(() => {
    if (shown) noteShown(id);
  }, [id, shown]);

  // Below the word, or above it when there is no room; never off the side of the window.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const t = trigger.current?.getBoundingClientRect();
      const p = pop.current?.getBoundingClientRect();
      if (!t || !p) return;
      const below = t.bottom + GAP;
      const top =
        below + p.height > window.innerHeight - MARGIN ? Math.max(MARGIN, t.top - GAP - p.height) : below;
      const left = Math.min(Math.max(MARGIN, t.left), Math.max(MARGIN, window.innerWidth - MARGIN - p.width));
      setAt({ top, left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    pop.current?.focus({ preventScroll: true });
    function away(e: PointerEvent) {
      const target = e.target as Node;
      if (pop.current?.contains(target) || trigger.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  if (!entry || !shown) return <>{children ?? entry?.term ?? id}</>;

  function close(refocus: boolean) {
    setOpen(false);
    setAt(null);
    if (refocus) trigger.current?.focus();
  }

  function onPopKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "Tab") {
      // The popover sits at the end of the page: Tab past its link goes back to the word.
      const links = pop.current?.querySelectorAll<HTMLElement>("a") ?? [];
      const last = links[links.length - 1];
      if (
        (!e.shiftKey && document.activeElement === last) ||
        (e.shiftKey && document.activeElement === pop.current)
      ) {
        e.preventDefault();
        close(true);
      }
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.term}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? popId : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) close(false);
          else {
            noteOpened(id);
            setOpen(true);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.stopPropagation();
            close(true);
          }
        }}
      >
        {children ?? entry.term}
        {fresh && (
          <span className={styles.fresh} aria-hidden>
            ?
          </span>
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={pop}
            id={popId}
            role="dialog"
            aria-label={entry.term}
            tabIndex={-1}
            className={styles.pop}
            style={at ? { top: at.top, left: at.left } : { top: 0, left: 0, visibility: "hidden" }}
            onKeyDown={onPopKey}
          >
            <span className={styles.name}>{entry.term}</span>
            <p className={styles.definition}>
              <InlineText text={entry.definition} />
            </p>
            {entry.example && (
              <div className={styles.example}>
                <span className={styles.exampleLabel}>From The Last Lighthouse</span>
                <span className={styles.exampleText}>{entry.example}</span>
              </div>
            )}
            <div className={styles.foot}>
              <a
                href={glossaryHref(entry.id)}
                className={styles.more}
                onClick={(e) => {
                  e.preventDefault();
                  close(false);
                  navigateTo(glossaryHref(entry.id));
                }}
              >
                More in the glossary
              </a>
              {entry.alsoCalled && entry.alsoCalled.length > 0 && (
                <span className={styles.also}>Also called: {entry.alsoCalled.join(", ")}</span>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
