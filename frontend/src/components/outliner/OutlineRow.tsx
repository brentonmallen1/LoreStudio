import { useLayoutEffect, useRef, useState, type DragEvent, type FocusEvent } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, GripVertical, PenLine } from "lucide-react";
import { sceneSheetPath } from "../../lib/scene/glance";
import { sceneStatus, statusWords } from "../../lib/outline/status";
import { DRAFT_ID, partSummary, type Row, type Shape } from "../../lib/outline/tree";
import { findNode } from "../layout/structureTreeMeta";
import { useStoryStore } from "../../stores/storyStore";
import Term from "../common/Term";
import MomentTag from "./MomentTag";
import OutlineMark from "./OutlineMark";
import { useActiveSheet } from "./usePattern";
import { clipTipHandlers } from "./clipTip";
import type { useHoverTip } from "../common/useHoverTip";
import styles from "./Outline.module.css";

export interface RowProps {
  row: Row;
  shape: Shape;
  storyId: string;
  /** The row the keyboard enters the list at (a roving tab stop). */
  stop: boolean;
  folded: boolean;
  open: boolean;
  dropZone?: "above" | "below" | "into";
  onToggle: (id: string) => void;
  onBlurLine: (id: string, e: FocusEvent) => void;
  onDragStart: (e: DragEvent, id: string) => void;
  onDragOver: (e: DragEvent, row: Row) => void;
  onDrop: (e: DragEvent, row: Row) => void;
  /** The list's one tip: a row reached by the keyboard shows its whole line when cut short. */
  tip: ReturnType<typeof useHoverTip>;
}

/**
 * One line of the Outline (doc 29 D2): a part (act, chapter) with its fold and what it holds,
 * or a scene with its status as a shape, each with a title and a line of what happens, both
 * typed in place. A scene unfolds to Why it's here, Whose eyes, its status and words, and
 * the way to write it. The title and the line are inputs out of the Tab order: the list's
 * keys move between them, and Esc leaves them for the row, whose buttons Tab then reaches.
 */
export default function OutlineRow(props: RowProps) {
  const { row, shape, storyId, folded, open } = props;
  const { node, depth, scene } = row;
  const draft = node.id === DRAFT_ID;
  const container = !scene;
  const level = shape.names[Math.min(depth, shape.names.length - 1)] ?? "Scene";
  const titleHint = draft
    ? scene
      ? "What happens next…"
      : `A new ${level.toLowerCase()}…`
    : `${level} title`;
  const fieldKey = `${node.id}:${node.title}:${node.synopsis}`;
  const unfoldable = (container && !!node.children?.length) || (scene && !draft);
  const expanded = container ? !folded : open;
  const meta =
    container && !draft
      ? partSummary(node, depth, shape)
      : scene && !draft && !node.word_count
        ? "planned, no words yet"
        : "";
  // An unfolded scene shows its whole line of what happens when the row cuts it short.
  const synopsisRef = useRef<HTMLInputElement>(null);
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    const el = synopsisRef.current;
    setCut(!!open && !!el && el.scrollWidth > el.clientWidth + 1);
  }, [open, node.synopsis]);

  return (
    <div
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={props.stop}
      aria-expanded={unfoldable ? expanded : undefined}
      aria-label={node.title || titleHint}
      tabIndex={props.stop ? 0 : -1}
      data-outline-row={node.id}
      data-depth={Math.min(depth, 2)}
      data-kind={scene ? "scene" : depth === 0 ? "top" : "part"}
      data-open={(scene && open) || undefined}
      data-drop={props.dropZone}
      className={styles.row}
      style={{ "--depth": depth } as React.CSSProperties}
      onDragOver={(e) => props.onDragOver(e, row)}
      onDrop={(e) => props.onDrop(e, row)}
      {...clipTipHandlers(props.tip, [node.title, node.synopsis, meta].filter(Boolean).join(" · "))}
    >
      <div className={styles.line}>
        {!draft && (
          <span
            className={styles.grip}
            draggable
            onDragStart={(e) => props.onDragStart(e, node.id)}
            aria-hidden
            title="Drag to move"
          >
            <GripVertical size={12} />
          </span>
        )}
        {container ? (
          <button
            type="button"
            className={styles.fold}
            onClick={() => props.onToggle(node.id)}
            disabled={!node.children?.length}
            aria-label={`${folded ? "Unfold" : "Fold"} ${node.title || level}`}
            tabIndex={node.children?.length ? 0 : -1}
          >
            {folded ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
        ) : (
          <OutlineMark status={draft ? "planned" : sceneStatus(node)} />
        )}
        <span className={styles.text} key={fieldKey}>
          <input
            className={styles.title}
            data-outline-line={node.id}
            data-field="title"
            data-clip
            title={node.title || undefined}
            defaultValue={node.title}
            placeholder={titleHint}
            aria-label={draft ? titleHint : `${level} title`}
            tabIndex={-1}
            onBlur={(e) => props.onBlurLine(node.id, e)}
            size={Math.max(8, Math.min(48, (node.title || titleHint).length + 1))}
          />
          <input
            className={styles.synopsis}
            data-outline-line={node.id}
            data-field="synopsis"
            data-clip
            ref={synopsisRef}
            title={node.synopsis || undefined}
            defaultValue={node.synopsis}
            placeholder="what happens…"
            aria-label="What happens"
            tabIndex={-1}
            onBlur={(e) => props.onBlurLine(node.id, e)}
          />
        </span>
        {meta && (
          <span className={styles.meta} data-clip title={meta}>
            {meta}
          </span>
        )}
        {scene && !draft && <SceneMoment nodeId={node.id} beatId={node.beat_id} />}
        {scene && !draft && (
          <button
            type="button"
            className={styles.more}
            aria-expanded={open}
            aria-label={`${open ? "Fold" : "Unfold"} “${node.title || "this scene"}”`}
            onClick={() => props.onToggle(node.id)}
          >
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        )}
      </div>
      {scene && open && !draft && <SceneDetails storyId={storyId} nodeId={node.id} whole={cut} />}
    </div>
  );
}

/** The moment of the classic pattern turned on that a scene carries, as a tag (doc 29 D5). */
function SceneMoment({ nodeId, beatId }: { nodeId: string; beatId: string | null | undefined }) {
  const { sheet, beatOf, carry } = useActiveSheet();
  const beat = beatOf(beatId);
  if (!sheet || !beat) return null;
  return <MomentTag beat={beat} pattern={sheet.name} onClear={() => void carry(nodeId, null)} />;
}

/** Which moment of the pattern turned on the scene carries, chosen from its unfolded row. */
function CarriesMoment({ nodeId, beatId }: { nodeId: string; beatId: string | null | undefined }) {
  const { sheet, carry } = useActiveSheet();
  if (!sheet) return null;
  const known = sheet.beats.some((b) => b.id === beatId);
  return (
    <div>
      <dt>Carries the moment</dt>
      <dd>
        <select
          className={styles.momentSelect}
          value={known ? (beatId ?? "") : ""}
          aria-label={`The moment of ${sheet.name} this scene carries`}
          onChange={(e) => void carry(nodeId, e.target.value || null)}
        >
          <option value="">None</option>
          {[...sheet.beats]
            .sort((a, b) => a.position_pct - b.position_pct)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
        </select>
      </dd>
    </div>
  );
}

/** A scene unfolded: why it is here, whose eyes, where it stands, and the way to it. */
function SceneDetails({ storyId, nodeId, whole }: { storyId: string; nodeId: string; whole: boolean }) {
  const node = useStoryStore((s) => findNode(s.structure, nodeId));
  const characters = useStoryStore((s) => s.characters);
  if (!node) return null;
  const eyes = characters.find((c) => c.id === node.pov_character_id)?.name;
  return (
    <div className={styles.details}>
      {whole && <p className={styles.whole}>{node.synopsis}</p>}
      <dl className={styles.facts}>
        <div>
          <dt>
            <Term id="why-its-here">Why it's here</Term>
          </dt>
          <dd>{node.purpose || "Not written yet"}</dd>
        </div>
        <div>
          <dt>Whose eyes</dt>
          <dd>{eyes ?? "Not chosen"}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{statusWords(node)}</dd>
        </div>
        <CarriesMoment nodeId={node.id} beatId={node.beat_id} />
      </dl>
      <div className={styles.detailActions}>
        <Link to={`/stories/${storyId}/write/${node.id}`} className={styles.secondary}>
          <PenLine size={13} aria-hidden /> Write this scene
        </Link>
        <Link to={sceneSheetPath(storyId, node.id)} className={styles.secondary}>
          Scene sheet
        </Link>
      </div>
    </div>
  );
}
