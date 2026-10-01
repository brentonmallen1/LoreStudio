import { useNavigate } from "react-router-dom";
import { api } from "../../../api/client";
import { KINDS } from "../../../lib/lorebook/kinds";
import { sectionPath } from "../../../lib/routes";
import { useStoryStore } from "../../../stores/storyStore";
import type { Era, HistoricalEvent } from "../../../types";
import { Badge, CardRow, SheetCard } from "../EntitySheet";
import RowsEditor from "../RowsEditor";
import { historyRows, type HistoryEntry } from "../../../lib/lorebook/rows";
import SimpleSection, { type SimpleSectionConfig } from "./SimpleSection";
import styles from "../Lorebook.module.css";

async function loadHistory(storyId: string): Promise<HistoryEntry[]> {
  const [eras, events] = await Promise.all([api.listEras(storyId), api.listHistoricalEvents(storyId)]);
  return [
    ...eras.map((e) => ({ ...e, kind: "era" as const })),
    ...events.map((e) => ({ ...e, kind: "event" as const })),
  ];
}

const asPatch = <T,>(p: Partial<T>) => p as unknown as Partial<HistoryEntry>;

export default function HistorySection() {
  const navigate = useNavigate();
  const storyId = useStoryStore((s) => s.activeStory?.id);
  const open = (id: string) => storyId && navigate(sectionPath(storyId, "lorebook", "history", id));

  const config: SimpleSectionConfig<HistoryEntry> = {
    kind: "event",
    section: "history",
    undoTypes: ["era", "historical_event"],
    load: loadHistory,
    // A new event goes into the era that is open, or the era of the event that is open.
    create: async (sid, name, { all, selected }) => {
      const eraId =
        selected?.kind === "era" ? selected.id : selected?.kind === "event" ? selected.era_id : null;
      const position = all.filter((e) => e.kind === "event" && e.era_id === eraId).length;
      const ev = await api.createHistoricalEvent(sid, { name, era_id: eraId, position });
      return { ...ev, kind: "event" };
    },
    secondaryAdd: {
      label: "Era",
      create: async (sid, all) => {
        const era = await api.createEra(sid, {
          name: "New era",
          position: all.filter((e) => e.kind === "era").length,
        });
        return { ...era, kind: "era" };
      },
    },
    addLabel: "Event",
    listTitle: "History",
    update: async (id, patch, entry) => {
      const { kind: _kind, ...rest } = patch as Partial<HistoryEntry> & { kind?: string };
      void _kind;
      return entry.kind === "era"
        ? { ...(await api.updateEra(id, rest as Partial<Era>)), kind: "era" as const }
        : {
            ...(await api.updateHistoricalEvent(id, rest as Partial<HistoricalEvent>)),
            kind: "event" as const,
          };
    },
    remove: (id, entry) => (entry.kind === "era" ? api.deleteEra(id) : api.deleteHistoricalEvent(id)),
    rows: historyRows,
    badges: (e) =>
      e.kind === "era" ? (
        <Badge>Era</Badge>
      ) : e.in_world_date ? (
        <Badge>{e.in_world_date}</Badge>
      ) : (
        <Badge>Event</Badge>
      ),
    fields: (e) => (e.kind === "era" ? KINDS.era.fields : KINDS.event.fields),
    extras: (e, save, all) =>
      e.kind === "era" ? (
        <RowsEditor
          entityKey={`${e.id}:figures`}
          title="Key figures"
          rows={e.key_figures}
          columns={[
            { key: "name", label: "Name" },
            { key: "role", label: "Role", grow: 2 },
          ]}
          blank={() => ({ name: "", role: "" })}
          addLabel="Add a key figure"
          save={(key_figures) => save(asPatch<Era>({ key_figures }))}
        />
      ) : (
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="event-era">
            Era
          </label>
          <div className={styles.rowEdit}>
            <select
              id="event-era"
              className={styles.grow}
              value={e.era_id ?? ""}
              onChange={(ev) => void save(asPatch<HistoricalEvent>({ era_id: ev.target.value || null }))}
            >
              <option value="">Not in an era</option>
              {all
                .filter((x) => x.kind === "era")
                .map((era) => (
                  <option key={era.id} value={era.id}>
                    {era.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      ),
    side: (e, all) => {
      if (e.kind === "era") {
        const events = all.filter(
          (x): x is HistoricalEvent & { kind: "event" } => x.kind === "event" && x.era_id === e.id,
        );
        return (
          <SheetCard title="Events" meta={events.length}>
            {events.length === 0 ? (
              <p className={styles.cardEmpty}>None yet. Add one with Event while this era is open.</p>
            ) : (
              events.map((ev) => (
                <CardRow key={ev.id} text={ev.name} note={ev.in_world_date} onClick={() => open(ev.id)} />
              ))
            )}
          </SheetCard>
        );
      }
      const era = all.find((x) => x.kind === "era" && x.id === e.era_id);
      return era ? (
        <SheetCard title="In the era">
          <CardRow
            text={era.name}
            note={[(era as Era).start_date, (era as Era).end_date].filter(Boolean).join(" – ")}
            onClick={() => open(era.id)}
          />
        </SheetCard>
      ) : null;
    },
    assistant: (e, sid, openAI) =>
      e.kind === "event"
        ? [
            {
              label: "Trace ripple effects",
              title: "Physical remnants, cultural legacy, political effects",
              onRun: () => openAI({ feature: "implications", entityId: e.id, storyId: sid }),
            },
          ]
        : [],
    empty: "No history yet. Eras and the events in them: what happened before the story began.",
    newName: "New event",
    deleteDetail: (e) =>
      e.kind === "era"
        ? "Its events stay, under “Not in an era”. You can bring it back with Undo."
        : undefined,
  };
  return <SimpleSection config={config} />;
}
