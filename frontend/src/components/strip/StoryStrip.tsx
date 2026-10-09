import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { SHORTCUTS, formatCombo, matchesCombo } from "../../lib/keyboard/shortcuts";
import { stripPx, toggleStrip, type StripWidth } from "../../lib/strip/stripModel";
import { useColourContext, useStripLine } from "../../lib/strip/useColourContext";
import { useUIStore } from "../../stores/uiStore";
import { scaledPx } from "../../lib/appearance/uiScale";
import ColourModePicker from "./ColourModePicker";
import FullTree from "./FullTree";
import StripEdge from "./StripEdge";
import StripKey from "./StripKey";
import TransitStrip from "./TransitStrip";
import styles from "./Strip.module.css";

/**
 * The book down the left edge of every story page (refactor doc 11, phase 3). Collapsed, a
 * transit line of chapters and scenes; expanded, the outline at the width the author dragged
 * it to (doc 14). Either way it says where you are.
 */
export default function StoryStrip() {
  const { storyId } = useParams<{ storyId: string }>();
  const {
    stripWidth,
    setStripWidth,
    stripColourMode,
    setStripColourMode,
    stripPx: expandedPx,
    setStripPx,
    uiScale,
  } = useUIStore();
  const [hovering, setHovering] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragPx, setDragPx] = useState<number | null>(null);

  const line = useStripLine();
  const width: StripWidth = stripWidth;
  const ctx = useColourContext();
  const cycle = () => setStripWidth(toggleStrip(width));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (matchesCombo(e, SHORTCUTS.cycleStrip.combo)) {
        e.preventDefault();
        cycle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const picker = (
    <ColourModePicker
      mode={stripColourMode}
      onChange={setStripColourMode}
      open={pickerOpen}
      setOpen={setPickerOpen}
      line={line}
      ctx={ctx}
      wide={width !== "strip"}
    />
  );

  return (
    <nav
      aria-label="The book"
      className={styles.strip}
      // The collapsed line holds rem-sized controls, so it grows with the interface size.
      style={{
        width:
          dragPx ??
          (width === "strip" ? scaledPx(stripPx(width, expandedPx), uiScale) : stripPx(width, expandedPx)),
      }}
      data-width={width}
      data-dragging={dragPx !== null || undefined}
    >
      {width !== "strip" && (
        <StripEdge px={stripPx(width, expandedPx)} onDrag={setDragPx} onCommit={setStripPx} />
      )}

      {/* The colour picker on top, so the line runs the strip's full height (doc 24). The
          book's name in the trail is the Overview, so the strip has no Book button. */}
      {width === "strip" ? (
        <div className={`${styles.head} ${styles.headNarrow}`}>{picker}</div>
      ) : (
        <div className={styles.head}>
          {picker}
          <span className={styles.headSpacer} />
          <button
            className={styles.iconBtn}
            onClick={() => setStripWidth("strip")}
            aria-label="Collapse to the line"
            title={`Collapse to the line (${formatCombo(SHORTCUTS.cycleStrip.combo)})`}
          >
            <ChevronsLeft size={16} />
          </button>
        </div>
      )}

      {/* The key shows while the pointer is over the line itself. */}
      <div
        className={`${styles.body} ${width === "scenes" ? styles.bodyTree : ""}`}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {width === "strip" && (
          <TransitStrip line={line} mode={stripColourMode} ctx={ctx} storyId={storyId!} />
        )}
        {width === "scenes" && <FullTree storyId={storyId} />}
      </div>

      {width === "strip" && (
        <div className={styles.expandRow}>
          <button
            className={styles.iconBtn}
            onClick={cycle}
            aria-label="Expand the story strip"
            title={`Expand (${formatCombo(SHORTCUTS.cycleStrip.combo)})`}
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      )}
      {(hovering || pickerOpen) && <StripKey mode={stripColourMode} line={line} ctx={ctx} />}
    </nav>
  );
}
