import { isModClick, modClickLabel } from "../../lib/keyboard/shortcuts";
import { entityPresence } from "../../lib/panel/presence";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import type { ToolId } from "../../types/panel";
import { TOOL_LABELS } from "../../types/panel";
import NotesBoard from "../notes/NotesBoard";
import DialogueTool from "./dialogue/DialogueTool";
import NovelScene from "./scene/NovelScene";
import { entityColor } from "./entityColor";
import styles from "./Panel.module.css";
import EmptyState from "../common/EmptyState";
import { EMPTY } from "../../lib/emptyStates";
import { sectionPath } from "../../lib/routes";

/**
 * What a tool on the rail shows (doc 11, doc 24 D11): the Lorebook lists, the planning scratch
 * tools, the open scene's dialogue as a thread, and in an adaptation the novel's own scene.
 */
export default function ToolTab({ tool }: { tool: ToolId }) {
  const { activeStory } = useStoryStore();
  if (!activeStory) return null;
  if (tool === "notes") return <NotesBoard compact />;
  if (tool === "dialogue") return <DialogueTool />;
  if (tool === "novel") return <NovelScene />;
  return <EntityList tool={tool} />;
}

function EntityList({ tool }: { tool: "characters" | "places" | "threads" }) {
  const { activeStory, activeNode, structure, sceneCast, characters, locations, threads } = useStoryStore();
  const { openEntity, setHighlight, tabs } = usePanelStore();
  const openIds = new Set(tabs.filter((t) => t.kind === "entity").map((t) => t.id));
  const kind = tool === "characters" ? "character" : tool === "places" ? "location" : "thread";
  const rows =
    tool === "characters"
      ? characters.map((c) => ({ id: c.id, title: c.name, meta: c.role, entity: c }))
      : tool === "places"
        ? locations.map((l) => ({ id: l.id, title: l.name, meta: l.location_type, entity: l }))
        : threads.map((t) => ({ id: t.id, title: t.name, meta: t.status, entity: t }));

  return (
    <section className={styles.section}>
      <h4 className={styles.heading}>{TOOL_LABELS[tool]}</h4>
      {rows.length === 0 ? (
        <EmptyState
          copy={EMPTY[tool]}
          size="small"
          action={
            activeStory
              ? {
                  label:
                    tool === "characters"
                      ? "Open Characters"
                      : tool === "places"
                        ? "Open Places"
                        : "Open Threads",
                  to:
                    tool === "threads"
                      ? sectionPath(activeStory.id, "promises", "threads")
                      : sectionPath(activeStory.id, "lorebook", tool),
                }
              : undefined
          }
        />
      ) : (
        <div className={styles.list}>
          {/* What the dots are, on the page (doc 30 D8). */}
          <p className={styles.listKey}>
            Each dot is its color in the strip and on its tab. Point at one, or reach it with Tab, to mark its
            scenes in the strip.
          </p>
          {rows.map((row) => {
            const onPage = entityPresence(
              kind,
              row.entity,
              activeNode,
              structure,
              sceneCast,
              characters,
            ).onPage;
            const open = openIds.has(`entity:${kind}:${row.id}`);
            return (
              <button
                key={row.id}
                className={styles.row}
                title={`${modClickLabel()} to open it as a tab and stay on this list`}
                // ⌘-click opens it behind, so several can be opened without leaving the list.
                onClick={(e) => openEntity(kind, row.id, row.title, isModClick(e))}
                onAuxClick={(e) => {
                  if (e.button === 1) openEntity(kind, row.id, row.title, true);
                }}
                onMouseEnter={() => setHighlight({ kind, id: row.id, name: row.title })}
                onMouseLeave={() => setHighlight(null)}
                onFocus={() => setHighlight({ kind, id: row.id, name: row.title })}
                onBlur={() => setHighlight(null)}
              >
                <span
                  className={styles.tabDot}
                  style={{ background: entityColor(kind, row.id) }}
                  aria-hidden
                />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle} title={row.title}>
                    {row.title}
                  </span>
                  {row.meta && <span className={styles.rowMeta}>{row.meta}</span>}
                </span>
                {onPage && <span className={styles.tag}>on this page</span>}
                {open && <span className={styles.rowMeta}>open</span>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
