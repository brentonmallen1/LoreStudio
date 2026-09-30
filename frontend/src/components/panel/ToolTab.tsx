import { entityPresence } from "../../lib/panel/presence";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import type { PanelTab, ToolId } from "../../types/panel";
import { TOOL_LABELS } from "../../types/panel";
import IdeaView from "../plan/IdeaView";
import QuestionsList from "../plan/QuestionsList";
import { KIND_COLOR } from "./tabColors";
import styles from "./Panel.module.css";

type ToolPanelTab = Extract<PanelTab, { kind: "tool" }>;

/** The Lorebook lists and the planning scratch tools, as tabs (doc 11). */
export default function ToolTab({ tab }: { tab: ToolPanelTab }) {
  const { activeStory } = useStoryStore();
  if (!activeStory) return null;
  if (tab.tool === "ideas") return <IdeaView storyId={activeStory.id} />;
  if (tab.tool === "questions") {
    return (
      <section className={styles.section}>
        <QuestionsList storyId={activeStory.id} />
      </section>
    );
  }
  return <EntityList tool={tab.tool} />;
}

function EntityList({ tool }: { tool: Exclude<ToolId, "ideas" | "questions"> }) {
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
            const onPage = entityPresence(kind, row.entity, activeNode, structure, sceneCast).onPage;
            const open = openIds.has(`entity:${kind}:${row.id}`);
            return (
              <button
                key={row.id}
                className={styles.row}
                onClick={() => openEntity(kind, row.id, row.title)}
                onMouseEnter={() => setHighlight({ kind, id: row.id, name: row.title })}
                onMouseLeave={() => setHighlight(null)}
              >
                <span className={styles.tabDot} style={{ background: KIND_COLOR[kind] }} />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{row.title}</span>
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
