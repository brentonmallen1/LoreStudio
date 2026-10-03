import { ArrowUpRight, ChevronRight, Pilcrow } from "lucide-react";
import type { Story } from "../../../types";
import PopoverMenu from "../../common/PopoverMenu";
import { useFoldOpen } from "../../../lib/panel/fold";
import { openScene } from "../../../lib/panel/openScene";
import { PROSE_AMOUNTS, excerpt, proseParagraphs, type Sequence } from "../../../lib/panel/sequence";
import { useFullNode } from "../../../lib/panel/useFullNode";
import { usePanelStore } from "../../../stores/panelStore";
import styles from "./SceneSequence.module.css";

const AMOUNT_LABEL: Record<number, string> = {
  1: "One paragraph",
  3: "Three paragraphs",
  6: "Six paragraphs",
};

/**
 * The scene before the open one ("Coming in from") or after it ("Heading to"), read-only:
 * its prose first, because the prose always exists and the planning fields often do not,
 * then where it leaves things or picks up. At the story's edges it says so.
 */
export default function NeighbourScene({
  side,
  sequence,
  story,
}: {
  side: "before" | "after";
  sequence: Sequence;
  story: Story;
}) {
  const neighbour = sequence[side];
  const label = side === "before" ? "Coming in from" : "Heading to";
  const [open, setOpen] = useFoldOpen(`neighbour-${side}`, true);
  const full = useFullNode(open ? neighbour?.node.id : null);
  const amount = usePanelStore((s) => s.proseAmount);
  const setAmount = usePanelStore((s) => s.setProseAmount);

  if (!neighbour) {
    return (
      <section className={styles.edge} aria-label={label}>
        {side === "before" ? (
          <>
            <p className={styles.edgeTitle}>The story opens here</p>
            {story.logline && <p className={styles.edgeText}>{story.logline}</p>}
          </>
        ) : (
          <p className={styles.edgeTitle}>This is the last scene so far</p>
        )}
      </section>
    );
  }

  const paragraphs = full ? proseParagraphs(full.content) : [];
  const shown = excerpt(paragraphs, amount, side === "before" ? "end" : "start");
  const cut = paragraphs.length > shown.length;
  const state = side === "before" ? full?.exit_state : full?.entry_state;

  return (
    <section className={styles.neighbour} aria-label={`${label} ${neighbour.node.title}`}>
      <div className={styles.head}>
        <button type="button" className={styles.foldBtn} aria-expanded={open} onClick={() => setOpen(!open)}>
          <ChevronRight size={13} className={open ? styles.chevronOpen : styles.chevron} aria-hidden />
          {label}
        </button>
        <button
          type="button"
          className={styles.sceneLink}
          onClick={() => openScene(neighbour.node.id)}
          title={`Open “${neighbour.node.title}” to write`}
        >
          <span className={styles.sceneLinkText}>{neighbour.node.title}</span>
          <ArrowUpRight size={12} aria-hidden />
        </button>
        {open && (
          <PopoverMenu
            label="How much of the scenes either side to show"
            trigger={<Pilcrow size={13} />}
            items={PROSE_AMOUNTS.map((n) => ({
              label: AMOUNT_LABEL[n],
              checked: n === amount,
              onSelect: () => setAmount(n),
            }))}
          />
        )}
      </div>

      {open && (
        <div className={styles.body}>
          {neighbour.chapterBreak && <p className={styles.break}>{neighbour.chapterBreak}</p>}
          {!full ? (
            <p className={styles.muted}>Loading…</p>
          ) : (
            <>
              {shown.length > 0 ? (
                <div className={styles.prose}>
                  {side === "before" && cut && <p className={styles.cut}>…</p>}
                  {shown.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                  {side === "after" && cut && <p className={styles.cut}>…</p>}
                </div>
              ) : (
                <p className={styles.muted}>Not written yet.</p>
              )}
              {state && (
                <div className={styles.fact}>
                  <span className={styles.factLabel}>
                    {side === "before" ? "Where it left things" : "Picks up with"}
                  </span>
                  <p>{state}</p>
                </div>
              )}
              {(side === "after" || shown.length === 0) && full.synopsis && (
                <div className={styles.fact}>
                  <span className={styles.factLabel}>What happens</span>
                  <p>{full.synopsis}</p>
                </div>
              )}
              {shown.length === 0 && !state && !full.synopsis && (
                <p className={styles.muted}>Nothing outlined for it yet either.</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
