import { useRef, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { sceneSheetPath } from "../../lib/scene/glance";
import { sceneStatus } from "../../lib/outline/status";
import { cardColumns, type CardColumn } from "../../lib/outline/cards";
import { dropSpot } from "../../lib/outline/place";
import { leafDepth, levelType, levelWord, moveTo, shapeOf } from "../../lib/outline/tree";
import { useStoryStore } from "../../stores/storyStore";
import CardColumns from "./CardColumns";
import OutlineMark from "./OutlineMark";
import { useOutlineActions } from "./useOutlineActions";
import { useActiveSheet } from "./usePattern";
import { ideaDrag, useTrayContext } from "./useTray";
import patternStyles from "./Pattern.module.css";
import styles from "./Outline.module.css";

/**
 * The Outline as cards, as the reader meets it (doc 29 D2, once the Storyboard): a column per
 * chapter (or whatever holds the scenes), a card per scene. Drag a card to move it, into
 * another column too; it saves as it goes, like everything else. A card opens its scene sheet.
 */
export default function OutlineCards({ storyId }: { storyId: string }) {
  const structure = useStoryStore((s) => s.structure);
  const template = useStoryStore((s) => s.activeTemplate);
  const shape = shapeOf(template);
  const actions = useOutlineActions(storyId);
  const tray = useTrayContext();
  const { beatOf } = useActiveSheet();
  const columns = cardColumns(structure, shape);
  const dragged = useRef<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; zone: "above" | "below" | "into" } | null>(null);
  const [notice, setNotice] = useState("");

  function over(e: DragEvent, id: string, zone: "above" | "below" | "into" | null) {
    if (ideaDrag.get() && !dragged.current) {
      if (!zone || !dropSpot(structure, shape, id, zone)) return;
      e.preventDefault();
      e.stopPropagation();
      if (drop?.id !== id || drop.zone !== zone) setDrop({ id, zone });
      return;
    }
    if (!dragged.current || !zone || dragged.current === id) return;
    e.preventDefault();
    e.stopPropagation();
    if (drop?.id !== id || drop.zone !== zone) setDrop({ id, zone });
  }

  function land(e: DragEvent, id: string, zone: "above" | "below" | "into" | null) {
    const idea = ideaDrag.get();
    if (idea && tray && !dragged.current) {
      const spot = zone && dropSpot(structure, shape, id, zone);
      ideaDrag.set(null);
      setDrop(null);
      if (!spot) return;
      e.preventDefault();
      e.stopPropagation();
      void tray.place(idea.id, spot);
      return;
    }
    const from = dragged.current;
    dragged.current = null;
    setDrop(null);
    if (!from || !zone || from === id) return;
    e.preventDefault();
    e.stopPropagation();
    const move = moveTo(structure, from, id, zone, shape);
    if ("refused" in move) return setNotice(move.refused);
    setNotice("");
    void actions.apply(move);
  }

  const half = (e: DragEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return e.clientY - rect.top < rect.height / 2 ? "above" : "below";
  };

  return (
    <div className={styles.cardsWrap}>
      <CardColumns label="The scenes, a column each" onDragEnd={() => setDrop(null)}>
        {columns.map((col) => (
          <section
            key={col.key}
            className={styles.column}
            aria-label={col.title}
            data-drop={col.node && drop?.id === col.node.id ? "into" : undefined}
            onDragOver={(e) => col.node && over(e, col.node.id, "into")}
            onDrop={(e) => col.node && land(e, col.node.id, "into")}
          >
            {col.over && <span className={styles.columnOver}>{col.over}</span>}
            <h3 className={styles.columnTitle}>{col.title}</h3>
            {col.scenes.map((scene) => (
              <Link
                key={scene.id}
                to={sceneSheetPath(storyId, scene.id)}
                className={styles.card}
                draggable
                data-drop={drop?.id === scene.id ? drop.zone : undefined}
                onDragStart={(e) => {
                  dragged.current = scene.id;
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", scene.title);
                }}
                onDragOver={(e) => over(e, scene.id, half(e))}
                onDrop={(e) => land(e, scene.id, half(e))}
              >
                <span className={styles.cardHead}>
                  <OutlineMark status={sceneStatus(scene)} />
                  <span className={styles.cardTitle}>{scene.title || "Untitled scene"}</span>
                </span>
                {beatOf(scene.beat_id) && (
                  <span className={patternStyles.cardTag}>{beatOf(scene.beat_id)?.name}</span>
                )}
                {scene.synopsis && <span className={styles.cardWhat}>{scene.synopsis}</span>}
                <span className={styles.cardMeta}>
                  {scene.word_count ? `${scene.word_count.toLocaleString()} words` : "planned, no words yet"}
                </span>
              </Link>
            ))}
            {col.scenes.length === 0 && (
              <p className={styles.columnEmpty}>No {levelWord(shape, leafDepth(shape), true)} yet</p>
            )}
            <AddCard storyId={storyId} column={col} shape={shape} />
          </section>
        ))}
      </CardColumns>
      <p className={styles.notice} role="status" aria-live="polite">
        {notice}
      </p>
    </div>
  );
}

/** A planned scene typed at the foot of a column. */
function AddCard({
  storyId,
  column,
  shape,
}: {
  storyId: string;
  column: CardColumn;
  shape: ReturnType<typeof shapeOf>;
}) {
  const [adding, setAdding] = useState(false);
  const { add } = useOutlineActions(storyId);
  const word = levelWord(shape, leafDepth(shape));
  if (!adding)
    return (
      <button type="button" className={styles.addCard} onClick={() => setAdding(true)}>
        <Plus size={13} aria-hidden /> Add a {word}
      </button>
    );
  const commit = (title: string) => {
    setAdding(false);
    if (!title.trim()) return;
    const depth = leafDepth(shape);
    void add({
      parentId: column.node?.id ?? null,
      depth,
      position: column.node ? (column.node.children?.length ?? 0) : column.scenes.length,
      levelType: levelType(shape, depth),
      title: title.trim(),
      scene: true,
    });
  };
  return (
    <input
      autoFocus
      className={styles.addCardInput}
      placeholder={`What happens in this ${word}…`}
      aria-label={`A new ${word} in ${column.title}`}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit(e.currentTarget.value);
        if (e.key === "Escape") setAdding(false);
      }}
    />
  );
}
