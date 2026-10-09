import { isModClick, modClickLabel } from "../../lib/keyboard/shortcuts";
import { entityPresence } from "../../lib/panel/presence";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import type { ToolId } from "../../types/panel";
import { TOOL_LABELS } from "../../types/panel";
import FreewriteEditor from "../freewrite/FreewriteEditor";
import NotesBoard from "../notes/NotesBoard";
import DialogueTool from "./dialogue/DialogueTool";
import { entityColor } from "./entityColor";
import styles from "./Panel.module.css";

/**
 * What a tool on the rail shows (doc 11, doc 24 D11): the Lorebook lists, the planning scratch
 * tools, and the open scene's dialogue as a thread.
 */
export default function ToolTab({ tool }: { tool: ToolId }) {
  const { activeStory } = useStoryStore();
  if (!activeStory) return null;
  if (tool === "freewrite") return <FreewriteEditor storyId={activeStory.id} compact />;
  if (tool === "notes") return <NotesBoard compact />;
  if (tool === "dialogue") return <DialogueTool />;
  return <EntityList tool={tool} />;
}

function EntityList({ tool }: { tool: "characters" | "places" | "threads" }) {
  const { activeNode, structure, sceneCast, characters, locations, threads } = useStoryStore();
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
        <p className={styles.empty}>Nothing here yet.</p>
      ) : (
        <div className={styles.list}>
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
              >
                <span className={styles.tabDot} style={{ background: entityColor(kind, row.id) }} />
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
