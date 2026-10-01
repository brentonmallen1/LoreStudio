import { api } from "../../../api/client";
import { KINDS } from "../../../lib/lorebook/kinds";
import { sectionPath } from "../../../lib/routes";
import { slotVar } from "../../../lib/colorSlots";
import { useStoryStore } from "../../../stores/storyStore";
import type { Calendar, Culture, LocationTravel, WorldSystem } from "../../../types";
import { CardRow, SheetCard } from "../EntitySheet";
import RowsEditor from "../RowsEditor";
import SimpleSection, { type SimpleSectionConfig } from "./SimpleSection";
import styles from "../Lorebook.module.css";
import { useNavigate } from "react-router-dom";

/**
 * The world's sections of the Lorebook (doc 12 P2): systems, cultures, calendars and routes,
 * each one configuration of the shared section. History has eras and events in one list, so
 * it has its own file.
 */

const SYSTEMS: SimpleSectionConfig<WorldSystem> = {
  kind: "system",
  section: "systems",
  undoTypes: ["world_system"],
  load: (storyId) => api.listWorldSystems(storyId),
  create: (storyId, name) => api.createWorldSystem(storyId, { name }),
  update: (id, patch) => api.updateWorldSystem(id, patch),
  remove: (id) => api.deleteWorldSystem(id),
  row: (e) => ({ sub: e.system_type || undefined }),
  extras: (e, save) => (
    <RowsEditor
      entityKey={e.id}
      title="Tiers"
      rows={e.hierarchy_tiers}
      columns={[
        { key: "name", label: "Tier", placeholder: "Tier name" },
        { key: "description", label: "Description", grow: 2 },
      ]}
      blank={() => ({ name: `Tier ${e.hierarchy_tiers.length + 1}`, description: "", examples: [] })}
      addLabel="Add a tier"
      save={(hierarchy_tiers) => save({ hierarchy_tiers })}
    />
  ),
  assistant: (e, storyId, openAI) => [
    {
      label: "Analyse edge cases",
      title: "Edge cases, story implications, consistency questions",
      onRun: () => openAI({ feature: "system", entityId: e.id, storyId }),
    },
  ],
  empty: "No systems yet. Magic, technology, faith, trade: the rules your world runs on.",
  newName: "New system",
};

const CULTURES: SimpleSectionConfig<Culture> = {
  kind: "culture",
  section: "cultures",
  undoTypes: ["culture"],
  load: (storyId) => api.listCultures(storyId),
  create: (storyId, name) => api.createCulture(storyId, { name }),
  update: (id, patch) => api.updateCulture(id, patch),
  remove: (id) => api.deleteCulture(id),
  row: (e) => ({ sub: e.government_type || undefined }),
  fields: () => [
    ...KINDS.culture.fields,
    { key: "naming", label: "Naming conventions", hint: "Given names, family names, titles, patterns…" },
  ],
  values: (e) => ({ ...e, naming: String((e.naming_conventions as { notes?: string })?.notes ?? "") }),
  patchFor: (key, value, e) =>
    key === "naming"
      ? { naming_conventions: { ...(e.naming_conventions ?? {}), notes: value } }
      : ({ [key]: value } as Partial<Culture>),
  assistant: (e, storyId, openAI) => [
    {
      label: "Suggest elements",
      title: "Naming patterns, rituals and customs, aesthetics and materials",
      onRun: () => openAI({ feature: "culture-suggest", entityId: e.id, storyId }),
    },
  ],
  empty: "No cultures yet. The peoples of your world: what they value, what they never do.",
  newName: "New culture",
};

const CALENDARS: SimpleSectionConfig<Calendar> = {
  kind: "calendar",
  section: "calendars",
  undoTypes: ["calendar"],
  load: (storyId) => api.listCalendars(storyId),
  create: (storyId, name) => api.createCalendar(storyId, { name }),
  update: (id, patch) => api.updateCalendar(id, patch),
  remove: (id) => api.deleteCalendar(id),
  row: (e) => ({
    sub: [
      e.months.length ? `${e.months.length} months` : "",
      e.special_days.length ? `${e.special_days.length} special days` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  }),
  fields: () => [
    ...KINDS.calendar.fields,
    { key: "week", label: "Days of the week", hint: "Comma-separated, in order", short: true },
  ],
  values: (e) => ({ ...e, week: e.week_day_names.join(", ") }),
  patchFor: (key, value) =>
    key === "week"
      ? (() => {
          const names = value
            .split(",")
            .map((n) => n.trim())
            .filter(Boolean);
          return { week_day_names: names, days_per_week: names.length || 7 };
        })()
      : ({ [key]: value } as Partial<Calendar>),
  extras: (e, save) => (
    <>
      <RowsEditor
        entityKey={`${e.id}:months`}
        title="Months"
        rows={e.months}
        columns={[
          { key: "name", label: "Month", grow: 2 },
          { key: "days", label: "Days", number: true },
        ]}
        blank={() => ({ name: `Month ${e.months.length + 1}`, days: 30 })}
        addLabel="Add a month"
        save={(months) => save({ months })}
      />
      <RowsEditor
        entityKey={`${e.id}:days`}
        title="Special days"
        rows={e.special_days}
        columns={[
          { key: "name", label: "Name", grow: 2 },
          { key: "month", label: "Month", number: true },
          { key: "day", label: "Day", number: true },
          { key: "description", label: "Description", grow: 3 },
        ]}
        blank={() => ({ name: "", month: 1, day: 1, description: "" })}
        addLabel="Add a special day"
        save={(special_days) => save({ special_days })}
      />
    </>
  ),
  assistant: (e, storyId, openAI) => [
    {
      label: "Suggest entries",
      title: "Festivals, seasonal events, historical observances",
      onRun: () => openAI({ feature: "calendar", entityId: e.id, storyId }),
    },
  ],
  empty: "No calendars yet. How the people of your story count their days.",
  newName: "New calendar",
};

export function SystemsSection() {
  return <SimpleSection config={SYSTEMS} />;
}

export function CulturesSection() {
  return <SimpleSection config={CULTURES} />;
}

export function CalendarsSection() {
  return <SimpleSection config={CALENDARS} />;
}

// Module-level so the section's reload does not change identity on every render.
const loadTravel = (storyId: string) => api.listLocationTravel(storyId);

/** Routes between places: named for their two ends, which are picked rather than typed. */
export function TravelSection() {
  const locations = useStoryStore((s) => s.locations);
  const activeStory = useStoryStore((s) => s.activeStory);
  const navigate = useNavigate();
  const placeName = (id: string) => locations.find((l) => l.id === id)?.name ?? "A place";
  const placeSlot = (id: string) => slotVar(locations.find((l) => l.id === id)?.color_slot);

  const config: SimpleSectionConfig<LocationTravel> = {
    kind: "travel",
    section: "travel",
    undoTypes: ["location_travel"],
    load: loadTravel,
    create: () =>
      api.createLocationTravel({
        from_location_id: locations[0].id,
        to_location_id: locations[1].id,
        travel_time: "",
      }),
    update: (id, patch) => api.updateLocationTravel(id, patch),
    remove: (id) => api.deleteLocationTravel(id),
    nameOf: (e) =>
      `${placeName(e.from_location_id)} ${e.bidirectional ? "↔" : "→"} ${placeName(e.to_location_id)}`,
    renamable: false,
    cannotAdd: () => (locations.length < 2 ? "A route joins two places. Add another place first." : null),
    row: (e) => ({ sub: [e.travel_time, e.travel_method].filter(Boolean).join(" · ") || undefined }),
    extras: (e, save) => (
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Between</span>
        <div className={styles.rowEdit}>
          <select
            aria-label="From"
            className={styles.grow}
            value={e.from_location_id}
            onChange={(ev) => void save({ from_location_id: ev.target.value })}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Which way"
            value={e.bidirectional ? "both" : "one"}
            onChange={(ev) => void save({ bidirectional: ev.target.value === "both" })}
          >
            <option value="both">both ways</option>
            <option value="one">one way</option>
          </select>
          <select
            aria-label="To"
            className={styles.grow}
            value={e.to_location_id}
            onChange={(ev) => void save({ to_location_id: ev.target.value })}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    ),
    side: (e) => (
      <SheetCard title="The two ends">
        {[e.from_location_id, e.to_location_id].map((id) => (
          <CardRow
            key={id}
            dot={placeSlot(id)}
            text={placeName(id)}
            note="place"
            onClick={() => activeStory && navigate(sectionPath(activeStory.id, "lorebook", "places", id))}
          />
        ))}
      </SheetCard>
    ),
    assistant: (e, storyId, openAI) => [
      {
        label: "Analyse route",
        title: "Journey considerations, hazards, narrative possibilities",
        onRun: () => openAI({ feature: "travel", entityId: e.id, storyId }),
      },
    ],
    empty: "No routes yet. How long it takes to get from one place to another, and what can stop you.",
    newName: "",
  };
  return <SimpleSection config={config} />;
}
