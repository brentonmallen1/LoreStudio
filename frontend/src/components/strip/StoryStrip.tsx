import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, Home } from "lucide-react";
import { SHORTCUTS, formatCombo, matchesCombo } from "../../lib/keyboard/shortcuts";
import { useOpenFindings } from "../../stores/findingsStore";
import {
  WIDTH_PX,
  buildLine,
  nextWidth,
  type ColourContext,
  type StripWidth,
} from "../../lib/strip/stripModel";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import ChapterRows from "./ChapterRows";
import ColourModePicker from "./ColourModePicker";
import FullTree from "./FullTree";
import StripEdge from "./StripEdge";
import StripKey from "./StripKey";
import ToolRail from "./ToolRail";
import TransitStrip from "./TransitStrip";
import styles from "./Strip.module.css";

/**
 * The book down the left edge of every story page (refactor doc 11, phase 3), at one of
 * three widths: a transit line of chapters and scenes, chapter rows, or the full tree.
 * Whatever the width, it says where you are and how far through you are.
 */
export default function StoryStrip() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { structure, activeTemplate, activeNode, sceneCast, characters, threads, beatSheets, activeStory } =
    useStoryStore();
  const { stripWidth, setStripWidth, stripColourMode, setStripColourMode } = useUIStore();
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
  const cycle = () => setStripWidth(nextWidth(width, line.hasStations));

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
      <Home size={14} />
    </button>
  );

  return (
    <nav
      aria-label="The book"
      className={styles.strip}
      style={{ width: dragPx ?? WIDTH_PX[width] }}
      data-width={width}
      data-dragging={dragPx !== null || undefined}
    >
      <StripEdge width={width} hasStations={line.hasStations} onWidth={setStripWidth} onDrag={setDragPx} />

      {width === "strip" ? (
        <div className={`${styles.head} ${styles.headNarrow}`}>
          {home}
          <span className={styles.readoutTop}>{line.readout.top}</span>
          <span className={styles.readoutBottom}>{line.readout.bottom}</span>
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
            title="Collapse to the line"
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
