import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { entityPresence, presenceLine } from "../../lib/panel/presence";
import { openScene } from "../../lib/panel/openScene";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import type { PanelTab } from "../../types/panel";
import CompactCharacterSheet from "./CompactCharacterSheet";
import CompactCompendiumSheet from "./CompactCompendiumSheet";
import CompactLocationSheet from "./CompactLocationSheet";
import CompactThreadSheet from "./CompactThreadSheet";
import CompactTwistSheet from "./CompactTwistSheet";
import type { SubjectType } from "../../api/assistantResults";
import { runActions, type Subject } from "../../lib/ai/sheetActions";
import AssistantBand from "../lorebook/assistant/AssistantBand";
import AssistantMenu from "../lorebook/assistant/AssistantMenu";
import { useKeptAnswers } from "../lorebook/assistant/useKeptAnswers";
import { KIND_LABEL } from "./tabColors";
import { entityColor } from "./entityColor";
import styles from "./Panel.module.css";

type EntityPanelTab = Extract<PanelTab, { kind: "entity" }>;

/**
 * One thing from the Lorebook beside the prose (doc 11): where it is on this page, the
 * fields that matter mid-scene, and a way to the full sheet when you need the rest.
 */
export default function EntityTab({ tab }: { tab: EntityPanelTab }) {
  const { activeStory, activeNode, structure, sceneCast, characters, locations, threads } = useStoryStore();
  const close = usePanelStore((s) => s.close);
  if (!activeStory) return null;
  const base = `/stories/${activeStory.id}`;
  const color = entityColor(tab.entityKind, tab.entityId);

  const entity =
    tab.entityKind === "character"
      ? characters.find((c) => c.id === tab.entityId)
      : tab.entityKind === "location"
        ? locations.find((l) => l.id === tab.entityId)
        : tab.entityKind === "thread"
          ? threads.find((t) => t.id === tab.entityId)
          : null;
  const tracked =
    tab.entityKind === "character" || tab.entityKind === "location" || tab.entityKind === "thread";
  if (tracked && !entity) {
    return (
      <section className={styles.section}>
        <p className={styles.empty}>
          This {KIND_LABEL[tab.entityKind].toLowerCase()} is no longer in the story.
        </p>
        <button className={styles.fullLink} onClick={() => close(tab.id)}>
          Close tab
        </button>
      </section>
    );
  }

  const presence = entity
    ? entityPresence(tab.entityKind, entity, activeNode, structure, sceneCast, characters)
    : null;
  const sub =
    tab.entityKind === "character"
      ? (characters.find((c) => c.id === tab.entityId)?.role ?? "")
      : tab.entityKind === "location"
        ? (locations.find((l) => l.id === tab.entityId)?.location_type ?? "")
        : tab.entityKind === "thread"
          ? (threads.find((t) => t.id === tab.entityId)?.status ?? "")
          : "";
  const fullPath =
    tab.entityKind === "character"
      ? `${base}/lorebook/characters/${tab.entityId}`
      : tab.entityKind === "location"
        ? `${base}/lorebook/places/${tab.entityId}`
        : tab.entityKind === "thread"
          ? `${base}/promises/threads/${tab.entityId}`
          : tab.entityKind === "twist"
            ? `${base}/promises/twists/${tab.entityId}`
            : `${base}/compendium/research/${tab.entityId}`;

  return (
    <div style={{ "--tab-color": color } as React.CSSProperties}>
      <EntityHead
        tab={tab}
        sub={sub}
        fullPath={fullPath}
        presence={presence}
        subject={
          tab.entityKind === "compendium"
            ? null
            : { storyId: activeStory.id, type: SUBJECT[tab.entityKind], id: tab.entityId, name: tab.label }
        }
      />
      {tab.entityKind === "character" && entity && (
        <CompactCharacterSheet character={characters.find((c) => c.id === tab.entityId)!} />
      )}
      {tab.entityKind === "location" && entity && (
        <CompactLocationSheet location={locations.find((l) => l.id === tab.entityId)!} />
      )}
      {tab.entityKind === "thread" && entity && (
        <CompactThreadSheet thread={threads.find((t) => t.id === tab.entityId)!} />
      )}
      {tab.entityKind === "twist" && <CompactTwistSheet storyId={activeStory.id} twistId={tab.entityId} />}
      {tab.entityKind === "compendium" && <CompactCompendiumSheet entryId={tab.entityId} />}
    </div>
  );
}

/** What the Assistant answers about, for each kind a tab can hold (A6). */
const SUBJECT: Record<Exclude<EntityPanelTab["entityKind"], "compendium">, SubjectType> = {
  character: "character",
  location: "location",
  thread: "plot_thread",
  twist: "twist",
};

/** The tab's head: kind, name, where it is, and in Studio mode the Assistant's menu and the
 * answers it kept, one row each (A6). */
function EntityHead({
  tab,
  sub,
  fullPath,
  presence,
  subject,
}: {
  tab: EntityPanelTab;
  sub: string;
  fullPath: string;
  presence: ReturnType<typeof entityPresence> | null;
  subject: Subject | null;
}) {
  const kept = useKeptAnswers(subject);
  const actions = subject ? runActions(subject) : [];
  return (
    <>
      <section className={styles.section}>
        <div className={styles.entityHead}>
          <div className={styles.entityHeadText}>
            <span className={styles.kind}>{KIND_LABEL[tab.entityKind]}</span>
            <h3 className={styles.title}>{tab.label}</h3>
            {sub && <span className={styles.sub}>{sub}</span>}
          </div>
          {subject && <AssistantMenu name={tab.label} actions={actions} kept={kept} compact />}
          <Link to={fullPath} className={styles.fullLink} title="Open the full sheet as the page">
            Full sheet <ArrowUpRight size={12} />
          </Link>
        </div>
        {presence && (
          <div className={`${styles.presence} ${presence.onPage ? styles.presenceOn : ""}`}>
            {presenceLine(presence)}
            {!presence.onPage && presence.lastSeen && (
              <>
                {" "}
                <button onClick={() => openScene(presence.lastSeen!.nodeId)}>Go there</button>
              </>
            )}
          </div>
        )}
        {subject && <AssistantBand subject={subject} actions={actions} kept={kept} />}
      </section>
    </>
  );
}
