import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { navigateMain } from "../../lib/panel/panelSync";
import { sceneStatus } from "../../lib/outline/status";
import { loadFolded, saveFolded } from "../../lib/outline/prefs";
import { shapeOf, visibleRows } from "../../lib/outline/tree";
import { useStoryStore } from "../../stores/storyStore";
import OutlineMark from "./OutlineMark";
import { useOutlineActions } from "./useOutlineActions";
import styles from "./Outline.module.css";

/**
 * The Outline beside the prose (doc 29 D2, B-OutlinePanel): the same lines, narrow, with the
 * scene being written marked. A line opens its scene in the prose; a double-click on a title
 * renames it. The full Outline is a click away for planning at length.
 */
export default function OutlinePanel({ storyId }: { storyId: string }) {
  const structure = useStoryStore((s) => s.structure);
  const template = useStoryStore((s) => s.activeTemplate);
  const here = useStoryStore((s) => s.activeNode?.id);
  const shape = shapeOf(template);
  const { save } = useOutlineActions(storyId);
  const [folded, setFolded] = useState(() => loadFolded(storyId));
  const [renaming, setRenaming] = useState<string | null>(null);
  const current = useRef<HTMLButtonElement>(null);
  const rows = visibleRows(structure, folded, shape);

  useEffect(() => {
    current.current?.scrollIntoView({ block: "nearest" });
  }, [here]);

  function fold(id: string) {
    const next = new Set(folded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    saveFolded(storyId, next);
    setFolded(next);
  }

  return (
    <div className={styles.panel}>
      <p className={styles.panelIntro}>
        Where you are in the story. Click a line to go there; double-click a title to rename it.
      </p>
      <div role="tree" aria-label="Outline" className={styles.panelTree}>
        {rows.map(({ node, depth, scene }) => {
          const on = node.id === here;
          if (renaming === node.id)
            return (
              <input
                key={node.id}
                autoFocus
                className={styles.panelRename}
                style={{ "--depth": depth } as React.CSSProperties}
                defaultValue={node.title}
                aria-label="Rename"
                onBlur={() => setRenaming(null)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setRenaming(null);
                  if (e.key === "Enter") {
                    const title = e.currentTarget.value.trim();
                    if (title && title !== node.title) void save(node.id, { title });
                    setRenaming(null);
                  }
                }}
              />
            );
          return (
            <button
              key={node.id}
              ref={on ? current : undefined}
              type="button"
              role="treeitem"
              aria-level={depth + 1}
              aria-selected={on}
              aria-expanded={node.children?.length ? !folded.has(node.id) : undefined}
              aria-current={on ? "true" : undefined}
              className={styles.panelRow}
              data-kind={scene ? "scene" : depth === 0 ? "top" : "part"}
              style={{ "--depth": depth } as React.CSSProperties}
              onClick={() =>
                scene
                  ? navigateMain(`/stories/${storyId}/write/${node.id}`)
                  : node.children?.length && fold(node.id)
              }
              onDoubleClick={() => setRenaming(node.id)}
            >
              {scene ? (
                <OutlineMark status={sceneStatus(node)} />
              ) : (
                <span className={styles.panelFold} aria-hidden>
                  {node.children?.length ? (
                    folded.has(node.id) ? (
                      <ChevronRight size={12} />
                    ) : (
                      <ChevronDown size={12} />
                    )
                  ) : null}
                </span>
              )}
              <span className={styles.panelText}>
                <span className={styles.panelTitle}>
                  {node.title || "Untitled"}
                  {on && <span className={styles.panelHere}> · writing now</span>}
                </span>
                {scene && (node.synopsis || !node.word_count) && (
                  <span className={styles.panelWhat}>{node.synopsis || "planned, no words yet"}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={styles.panelFull}
        onClick={() => navigateMain(`/stories/${storyId}/outline`)}
      >
        Open the full Outline to plan at length
      </button>
    </div>
  );
}
