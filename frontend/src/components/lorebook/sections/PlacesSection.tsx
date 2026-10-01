import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client";
import { useReloadOnUndo } from "../../../hooks/useUndoRedo";
import { locationFields, typeLabel, typeValue } from "../../../lib/lorebook/kinds";
import { presenceLine, scenesWith } from "../../../lib/lorebook/presence";
import { sceneLeaves } from "../../../lib/planning/methods";
import { slotVar } from "../../../lib/colorSlots";
import { usePanelStore } from "../../../stores/panelStore";
import { useStoryStore } from "../../../stores/storyStore";
import { useUIStore } from "../../../stores/uiStore";
import type { Location, LocationTravel } from "../../../types";
import AssetPicker from "../../media/AssetPicker";
import PortraitEditor from "../../media/PortraitEditor";
import WorldBuildingAIPanel from "../../worldbuilding/WorldBuildingAIPanel";
import AssistantRow from "../AssistantRow";
import SameAsPicker from "../SameAsPicker";
import HealthCard from "../HealthCard";
import ConfirmDelete from "../ConfirmDelete";
import EntitySheet, { Badge, CardRow, SheetCard } from "../EntitySheet";
import FieldList from "../FieldList";
import LorebookList from "../LorebookList";
import { placeRows } from "../../../lib/lorebook/rows";
import { useLoreSelection } from "../useLoreSelection";
import styles from "../Lorebook.module.css";

/** Everything inside a place, at any depth: deleting it takes them too. */
function descendants(id: string, locations: Location[]): Location[] {
  const kids = locations.filter((l) => l.parent_id === id);
  return kids.flatMap((k) => [k, ...descendants(k.id, locations)]);
}

export default function PlacesSection() {
  const { locations, setLocations, upsertLocation, sceneCast, structure, activeTemplate } = useStoryStore();
  const { worldBuildingAIPanelOpen, openWorldBuildingAIPanel } = useUIStore();
  const openEntity = usePanelStore((s) => s.openEntity);
  const rows = useMemo(() => placeRows(locations), [locations]);
  const { storyId, selectedId, select } = useLoreSelection(
    "places",
    rows.map((r) => r.id),
    true,
  );
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Location | null>(null);
  const [routes, setRoutes] = useState<LocationTravel[]>([]);

  const reload = useCallback(
    () => api.listLocationsFlat(storyId).then(setLocations),
    [storyId, setLocations],
  );
  useReloadOnUndo(["location", "scene_setting"], () => void reload());
  useEffect(() => {
    api.listLocationTravel(storyId).then(setRoutes, () => setRoutes([]));
  }, [storyId]);

  const place = locations.find((l) => l.id === selectedId) ?? null;
  const total = sceneLeaves(structure, activeTemplate).length;
  const scenes = place ? scenesWith("location", place.id, sceneCast, structure, activeTemplate) : [];
  const parent = place?.parent_id ? locations.find((l) => l.id === place.parent_id) : undefined;
  const inside = place ? locations.filter((l) => l.parent_id === place.id) : [];
  const siblings = place
    ? locations.filter((l) => l.parent_id === place.parent_id && l.id !== place.id && parent)
    : [];
  const myRoutes = place
    ? routes.filter((r) => r.from_location_id === place.id || r.to_location_id === place.id)
    : [];
  const nameOf = (id: string) => locations.find((l) => l.id === id)?.name ?? "A place";

  async function add(parentId: string | null) {
    const created = await api.createLocation(storyId, {
      name: "New place",
      parent_id: parentId,
      position: locations.filter((l) => l.parent_id === parentId).length,
    });
    upsertLocation(created);
    setRenaming(created.id);
    select(created.id);
  }

  async function save(patch: Partial<Location>) {
    if (!place) return;
    // Writing anything about a place found in the prose means it has been looked at.
    const saved = await api.updateLocation(place.id, place.is_stub ? { ...patch, is_stub: false } : patch);
    upsertLocation(saved);
  }

  return (
    <div className={styles.section}>
      <LorebookList
        title="Places"
        items={rows}
        selectedId={selectedId}
        onSelect={(id) => select(id)}
        onAdd={() => add(null)}
        empty={
          <p className={styles.listEmpty}>
            No places yet. Where the story happens, from a whole world to one room.
          </p>
        }
      />
      <div className={styles.sheetScroll}>
        {place ? (
          <EntitySheet
            key={place.id}
            entityKey={place.id}
            name={place.name}
            startRenaming={renaming === place.id}
            onRename={(name) => {
              setRenaming(null);
              return save({ name });
            }}
            dot={place.is_stub ? null : slotVar(place.color_slot)}
            slot={{ value: place.color_slot, onChange: (color_slot) => void save({ color_slot }) }}
            badges={
              <>
                {place.is_stub && <Badge tone="warning">Found in your prose</Badge>}
                {parent && <Badge>Part of {parent.name}</Badge>}
                {place.aliases && place.aliases.length > 0 && (
                  <Badge>Also called {place.aliases.join(", ")}</Badge>
                )}
              </>
            }
            presence={presenceLine(scenes, total, "Set")}
            scenes={scenes}
            onOpenBeside={() => openEntity("location", place.id, place.name)}
            more={[
              { label: `Add a place inside ${place.name}`, icon: Plus, onSelect: () => void add(place.id) },
              { label: "Delete place", icon: Trash2, danger: true, onSelect: () => setDeleting(place) },
            ]}
            side={
              <>
                <HealthCard anchor="location_id" id={place.id} storyId={storyId} />
                <SheetCard title="Image">
                  <PortraitEditor
                    storyId={storyId}
                    objectType="location"
                    objectId={place.id}
                    placeholder={<MapPin size={28} />}
                  />
                </SheetCard>
                <SheetCard
                  title={parent ? `Within ${parent.name}` : "Inside it"}
                  meta={inside.length || undefined}
                >
                  {parent && (
                    <CardRow
                      dot={slotVar(parent.color_slot)}
                      text={parent.name}
                      note="contains it"
                      onClick={() => select(parent.id)}
                    />
                  )}
                  {inside.map((l) => (
                    <CardRow
                      key={l.id}
                      dot={slotVar(l.color_slot)}
                      text={l.name}
                      note="inside"
                      onClick={() => select(l.id)}
                    />
                  ))}
                  {siblings.slice(0, 5).map((l) => (
                    <CardRow
                      key={l.id}
                      dot={slotVar(l.color_slot)}
                      text={l.name}
                      note="beside it"
                      onClick={() => select(l.id)}
                    />
                  ))}
                  <button type="button" className={styles.quietBtn} onClick={() => void add(place.id)}>
                    <Plus size={11} aria-hidden />
                    Add a place inside
                  </button>
                </SheetCard>
                {myRoutes.length > 0 && (
                  <SheetCard title="Routes" meta={myRoutes.length}>
                    {myRoutes.map((r) => {
                      const other = r.from_location_id === place.id ? r.to_location_id : r.from_location_id;
                      return (
                        <CardRow
                          key={r.id}
                          text={nameOf(other)}
                          note={[r.travel_time, r.travel_method].filter(Boolean).join(" · ")}
                          onClick={() => select(other)}
                        />
                      );
                    })}
                  </SheetCard>
                )}
              </>
            }
            footer={
              <AssistantRow
                actions={[
                  {
                    label: "Brainstorm what exists",
                    title: "Built environment, natural environment, cultural presence",
                    onRun: () =>
                      openWorldBuildingAIPanel({ feature: "what-exists", entityId: place.id, storyId }),
                  },
                  {
                    label: "Suggest elements",
                    title: "Creatures, flora, naming patterns",
                    onRun: () =>
                      openWorldBuildingAIPanel({ feature: "location-suggest", entityId: place.id, storyId }),
                  },
                ]}
              />
            }
          >
            {place.is_stub && (
              <div className={styles.banner} role="status">
                <span className={styles.bannerText}>
                  Found in your prose{scenes.length ? `, in ${scenes[0].title}` : ""}. Describing it keeps it;
                  it also waits in <Link to={`/stories/${storyId}/proposals?kind=place`}>Proposals</Link>.
                </span>
                <button
                  type="button"
                  className={styles.quietBtn}
                  onClick={() => void save({ is_stub: false })}
                >
                  Keep it
                </button>
                <SameAsPicker
                  stubId={place.id}
                  className={styles.quietBtn}
                  onMerged={(into) => select(into, { replace: true })}
                />
              </div>
            )}
            <FieldList
              entityKey={place.id}
              fields={locationFields(place.location_type ?? "", place as unknown as Record<string, unknown>)}
              values={{ ...place, location_type: typeLabel(place.location_type ?? "") }}
              save={(key, value) =>
                save({ [key]: key === "location_type" ? typeValue(value) : value } as Partial<Location>)
              }
            />
            <AssetPicker storyId={storyId} objectType="location" objectId={place.id} />
          </EntitySheet>
        ) : (
          locations.length === 0 && (
            <div className={styles.emptySheet}>
              <MapPin size={22} aria-hidden />
              <p>Add the first place: the island, the house, the room.</p>
            </div>
          )
        )}
      </div>
      {worldBuildingAIPanelOpen && <WorldBuildingAIPanel />}
      {deleting && (
        <ConfirmDelete
          name={deleting.name}
          detail={(() => {
            const n = descendants(deleting.id, locations).length;
            return n
              ? `The ${n === 1 ? "place" : `${n} places`} inside it go too. You can bring them back with Undo.`
              : undefined;
          })()}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const parentId = deleting.parent_id;
            await api.deleteLocation(deleting.id);
            await reload();
            select(parentId ?? null, { replace: true });
          }}
        />
      )}
    </div>
  );
}
