import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Book, ChevronsLeft, ChevronsRight } from "lucide-react";
import { SHORTCUTS, formatCombo, matchesCombo } from "../../lib/keyboard/shortcuts";
import { useOpenFindings } from "../../stores/findingsStore";
import {
  buildLine,
  stripPx,
  toggleStrip,
  type ColourContext,
  type Readout,
  type StripWidth,
} from "../../lib/strip/stripModel";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import { scaledPx } from "../../lib/appearance/uiScale";
import ChapterRows from "./ChapterRows";
import ColourModePicker from "./ColourModePicker";
import FullTree from "./FullTree";
import StripEdge from "./StripEdge";
import StripKey from "./StripKey";
import ToolRail from "./ToolRail";
import TransitStrip from "./TransitStrip";
import styles from "./Strip.module.css";

/**
 * The book down the left edge of every story page (refactor doc 11, phase 3). Collapsed, a
 * transit line of chapters and scenes; expanded, chapter rows or the full tree at the width
 * the author dragged it to (doc 14). Either way it says where you are.
 */
export default function StoryStrip() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { structure, activeTemplate, activeNode, sceneCast, characters, threads, beatSheets, activeStory } =
    useStoryStore();
  const {
    stripWidth,
    setStripWidth,
    stripColourMode,
    setStripColourMode,
    stripPx: expandedPx,
    setStripPx,
    stripDepth,
    stripReadoutPct,
    toggleStripReadout,
    uiScale,
  } = useUIStore();
  const [hovering, setHovering] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragPx, setDragPx] = useState<number | null>(null);

  const line = useMemo(
    () => buildLine(structure, activeTemplate, activeNode?.id, sceneCast),
    [structure, activeTemplate, activeNode?.id, sceneCast],
  );
  // A flat outline has no chapters to show: that width falls through to the tree.
  const width: StripWidth = !line.hasStations && stripWidth === "chapters" ? "scenes" : stripWidth;
  const findings = useOpenFindings();
  const ctx: ColourContext = {
    characters,
    threads,
    beatSheet: beatSheets.find((b) => b.id === activeStory?.beat_sheet_id) ?? null,
    findings,
  };
  const cycle = () => setStripWidth(toggleStrip(width, stripDepth, line.hasStations));

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

  const atHome = /\/stories\/[^/]+\/?(overview)?$/.test(pathname);
  const home = (
    <button
      className={`${styles.homeBtn} ${atHome ? styles.homeBtnOn : ""}`}
      onClick={() => navigate(`/stories/${storyId}`)}
      title="Story overview"
      aria-label="Story overview"
    >
      <Book size={14} />
    </button>
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

      {width === "strip" ? (
        <div className={`${styles.head} ${styles.headNarrow}`}>
          {home}
          <button
            type="button"
            className={styles.readout}
            onClick={toggleStripReadout}
            title={readoutTitle(line.readout, stripReadoutPct)}
          >
            {stripReadoutPct ? `${line.readout.pct}%` : readoutText(line.readout)}
          </button>
          <button
            className={styles.iconBtn}
            onClick={cycle}
            aria-label="Expand the story strip"
            title={`Expand (${formatCombo(SHORTCUTS.cycleStrip.combo)})`}
          >
            <ChevronsRight size={13} />
          </button>
        </div>
      ) : (
        <div className={styles.head}>
          {home}
          <span className={styles.headTitle}>Manuscript</span>
          {line.hasStations && (
            <div className={styles.seg} role="group" aria-label="Show down to">
              <button
                className={`${styles.segBtn} ${width === "chapters" ? styles.segBtnOn : ""}`}
                aria-pressed={width === "chapters"}
                onClick={() => setStripWidth("chapters")}
              >
                Chapters
              </button>
              <button
                className={`${styles.segBtn} ${width === "scenes" ? styles.segBtnOn : ""}`}
                aria-pressed={width === "scenes"}
                onClick={() => setStripWidth("scenes")}
              >
                Scenes
              </button>
            </div>
          )}
          <button
            className={styles.iconBtn}
            onClick={() => setStripWidth("strip")}
            aria-label="Collapse to the line"
            title={`Collapse to the line (${formatCombo(SHORTCUTS.cycleStrip.combo)})`}
          >
            <ChevronsLeft size={13} />
          </button>
        </div>
      )}

      {/* The key shows while the pointer is over the line itself, not the foot: open the
          More menu there and the key would sit on top of it. */}
      <div
        className={styles.body}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {width === "strip" && (
          <TransitStrip line={line} mode={stripColourMode} ctx={ctx} storyId={storyId!} />
        )}
        {width === "chapters" && (
          <ChapterRows line={line} mode={stripColourMode} ctx={ctx} storyId={storyId!} />
        )}
        {width === "scenes" && <FullTree storyId={storyId} />}
      </div>

      <div className={`${styles.foot} ${width !== "strip" ? styles.footWide : ""}`}>
        <ColourModePicker
          mode={stripColourMode}
          onChange={setStripColourMode}
          open={pickerOpen}
          setOpen={setPickerOpen}
          line={line}
          ctx={ctx}
        />
        <ToolRail wide={width !== "strip"} />
      </div>
      {(hovering || pickerOpen) && <StripKey mode={stripColourMode} line={line} ctx={ctx} />}
    </nav>
  );
}

/** "1 of 7"; with nothing open, how many there are. */
function readoutText(r: Readout): string {
  return r.position === null ? `${r.total}` : `${r.position} of ${r.total}`;
}

function readoutTitle(r: Readout, pct: boolean): string {
  const where =
    r.position === null
      ? `${r.total} ${r.unit}${r.total === 1 ? "" : "s"}`
      : `${r.unit === "chapter" ? "Chapter" : "Scene"} ${r.position} of ${r.total}`;
  const through = `${r.pct}% of the words come before here`;
  return pct ? `${through} (${where}). Click for the ${r.unit}.` : `${where}. Click for how far through.`;
}
