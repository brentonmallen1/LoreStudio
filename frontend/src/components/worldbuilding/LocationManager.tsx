import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, ChevronRight, ChevronDown, Trash2, MapPin, FolderPlus } from "lucide-react";
import { api } from "../../api/client";
import type { Location, SceneSetting } from "../../types";
import styles from "./WorldBuilding.module.css";
import WorldAIPanel from "./WorldAIPanel";

interface Props {
  storyId: string;
  selectLocationName?: string;
}

const PREDEFINED_TYPES = [
  // Celestial
  "star_system", "star", "planet", "gas_giant", "moon",
  "asteroid_belt", "orbital_station", "space_habitat",
  // Terrestrial
  "continent", "region", "territory",
  "settlement", "district", "landmark", "structure",
  "natural_feature",
  // Mobile
  "vessel",
];

const CELESTIAL_TYPES = new Set([
  "star_system", "star", "planet", "gas_giant", "moon",
  "asteroid_belt", "orbital_station", "space_habitat",
]);

function LocationTreeItem({
  location,
  depth,
  selectedId,
  onSelect,
  expandedIds,
  onToggleExpand,
}: {
  location: Location;
  depth: number;
  selectedId: string | null;
  onSelect: (loc: Location) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}) {
  const isExpanded = expandedIds.has(location.id);
  const hasChildren = location.children && location.children.length > 0;

  return (
    <div>
      <div
        className={`${styles.listItem} ${selectedId === location.id ? styles.listItemActive : ""}`}
        style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
        onClick={() => onSelect(location)}
      >
        <button
          className={hasChildren ? styles.treeToggle : styles.treeTogglePlaceholder}
          onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggleExpand(location.id); }}
        >
          {hasChildren ? (isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
        </button>
        <MapPin size={12} color="var(--color-text-muted)" />
        <span className={styles.listItemName}>{location.name}</span>
        {location.location_type && (
          <span className={styles.listItemBadge}>{location.location_type}</span>
        )}
      </div>
      {isExpanded && hasChildren && (
        <div>
          {location.children.map((child) => (
            <LocationTreeItem
              key={child.id}
              location={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LocationManager({ storyId, selectLocationName }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [availableTypes, setAvailableTypes] = useState<string[]>(PREDEFINED_TYPES);
  const [sceneUsages, setSceneUsages] = useState<SceneSetting[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [newCustomType, setNewCustomType] = useState("");
  const [newParentId, setNewParentId] = useState<string | null>(null);

  const [showAI, setShowAI] = useState<"what-exists" | "suggest" | null>(null);

  // Reset AI panel when selection changes
  useEffect(() => { setShowAI(null); }, [selected?.id]);

  // Debounced save
  const saveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(() => {
    Promise.all([
      api.listLocations(storyId),
      api.getLocationTypes(storyId),
    ]).then(([locs, types]) => {
      setLocations(locs);
      setAvailableTypes(types);
      // Auto-expand roots
      setExpandedIds(new Set(locs.map((l) => l.id)));
      // Auto-select if navigated from a [[Setting]] mention
      if (selectLocationName) {
        function findByName(list: Location[]): Location | undefined {
          for (const loc of list) {
            if (loc.name.toLowerCase() === selectLocationName!.toLowerCase()) return loc;
            if (loc.children) {
              const found = findByName(loc.children);
              if (found) return found;
            }
          }
        }
        const match = findByName(locs);
        if (match) setSelected(match);
      }
    }).finally(() => setLoading(false));
  }, [storyId, selectLocationName]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selected) return;
    api.getSceneSettingsForLocation(selected.id).then(setSceneUsages).catch(() => {});
  }, [selected]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function scheduleUpdate(field: string, value: string) {
    if (!selected) return;
    setSelected((prev) => prev ? { ...prev, [field]: value } : null);
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      if (!selected) return;
      api.updateLocation(selected.id, { [field]: value }).then(() => load());
    }, 700);
  }

  async function createLocation() {
    if (!newName.trim()) return;
    const type = newType === "__custom__" ? newCustomType.trim() : newType;
    await api.createLocation(storyId, {
      name: newName.trim(),
      location_type: type,
      parent_id: newParentId,
    });
    setShowAddModal(false);
    setNewName("");
    setNewType("");
    setNewCustomType("");
    setNewParentId(null);
    load();
  }

  async function deleteLocation() {
    if (!selected) return;
    await api.deleteLocation(selected.id);
    setSelected(null);
    setShowDeleteConfirm(false);
    load();
  }

  function flattenForSelect(locs: Location[], depth = 0): { loc: Location; depth: number }[] {
    const result: { loc: Location; depth: number }[] = [];
    for (const loc of locs) {
      result.push({ loc, depth });
      if (loc.children?.length) result.push(...flattenForSelect(loc.children, depth + 1));
    }
    return result;
  }

  if (loading) return <div className={styles.loading}>Loading locations…</div>;

  return (
    <div className={styles.manager}>
      {/* Sidebar — location tree */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>Locations</h3>
          <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
            <Plus size={12} /> Add
          </button>
        </div>
        <div className={styles.sidebarList}>
          {locations.length === 0 ? (
            <div className={styles.emptyList}>No locations yet</div>
          ) : (
            locations.map((loc) => (
              <LocationTreeItem
                key={loc.id}
                location={loc}
                depth={0}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
                expandedIds={expandedIds}
                onToggleExpand={toggleExpand}
              />
            ))
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className={styles.detail}>
        {!selected ? (
          <div className={styles.detailEmpty}>
            <MapPin size={24} color="var(--color-text-subtle)" />
            <span>Select a location to view details</span>
          </div>
        ) : (
          <>
            <div className={styles.detailHeader}>
              <h2 className={styles.detailName}>{selected.name}</h2>
              <div className={styles.detailActions}>
                <button
                  className={styles.ghostBtn}
                  onClick={() => setShowAI((v) => v === "what-exists" ? null : "what-exists")}
                  style={{ fontSize: "0.72rem" }}
                >
                  What Exists Here?
                </button>
                <button
                  className={styles.ghostBtn}
                  onClick={() => setShowAI((v) => v === "suggest" ? null : "suggest")}
                  style={{ fontSize: "0.72rem" }}
                >
                  AI Suggest
                </button>
                <button
                  className={`${styles.iconBtn} ${styles.danger}`}
                  title="Delete location"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Name</label>
                <input
                  className={styles.fieldInput}
                  value={selected.name}
                  onChange={(e) => scheduleUpdate("name", e.target.value)}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Type</label>
                <TypeSelector
                  value={selected.location_type}
                  options={availableTypes}
                  onChange={(v) => scheduleUpdate("location_type", v)}
                  predefined={PREDEFINED_TYPES}
                />
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Climate</label>
                <input
                  className={styles.fieldInput}
                  placeholder="e.g. Temperate, Arctic…"
                  value={selected.climate}
                  onChange={(e) => scheduleUpdate("climate", e.target.value)}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Political Affiliation</label>
                <input
                  className={styles.fieldInput}
                  placeholder="e.g. Kingdom of Valdris…"
                  value={selected.political_affiliation}
                  onChange={(e) => scheduleUpdate("political_affiliation", e.target.value)}
                />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Terrain</label>
              <input
                className={styles.fieldInput}
                placeholder="e.g. Mountainous, coastal, dense forest…"
                value={selected.terrain}
                onChange={(e) => scheduleUpdate("terrain", e.target.value)}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Description</label>
              <textarea
                className={styles.fieldTextarea}
                placeholder="What does this place look like? Who lives here?"
                value={selected.description}
                onChange={(e) => scheduleUpdate("description", e.target.value)}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Atmosphere</label>
              <textarea
                className={styles.fieldTextarea}
                placeholder="The mood, feel, sensory details of this place…"
                value={selected.atmosphere}
                onChange={(e) => scheduleUpdate("atmosphere", e.target.value)}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>History</label>
              <textarea
                className={styles.fieldTextarea}
                placeholder="How did this place come to be? What has happened here?"
                value={selected.history}
                onChange={(e) => scheduleUpdate("history", e.target.value)}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Significance</label>
              <textarea
                className={styles.fieldTextarea}
                placeholder="Why does this place matter to the story?"
                value={selected.significance}
                onChange={(e) => scheduleUpdate("significance", e.target.value)}
              />
            </div>

            {/* Celestial Properties — shown for space types or when any field is populated */}
            {(CELESTIAL_TYPES.has(selected.location_type) ||
              selected.orbital_period || selected.distance_from_parent ||
              selected.gravity || selected.habitability || selected.radiation_level) && (
              <>
                <hr className={styles.divider} />
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} style={{ fontWeight: 600, color: "var(--color-text)" }}>
                    Celestial Properties
                  </label>
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Orbital Period</label>
                    <input
                      className={styles.fieldInput}
                      placeholder="e.g. 365 days, 11.86 years…"
                      value={selected.orbital_period}
                      onChange={(e) => scheduleUpdate("orbital_period", e.target.value)}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Distance from Parent</label>
                    <input
                      className={styles.fieldInput}
                      placeholder="e.g. 1 AU, 384,400 km…"
                      value={selected.distance_from_parent}
                      onChange={(e) => scheduleUpdate("distance_from_parent", e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Gravity</label>
                    <input
                      className={styles.fieldInput}
                      placeholder="e.g. 1g, 0.38g, microgravity…"
                      value={selected.gravity}
                      onChange={(e) => scheduleUpdate("gravity", e.target.value)}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Habitability</label>
                    <input
                      className={styles.fieldInput}
                      placeholder="e.g. breathable, pressure suit required…"
                      value={selected.habitability}
                      onChange={(e) => scheduleUpdate("habitability", e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Radiation Level</label>
                  <input
                    className={styles.fieldInput}
                    placeholder="e.g. nominal, elevated during flares, lethal…"
                    value={selected.radiation_level}
                    onChange={(e) => scheduleUpdate("radiation_level", e.target.value)}
                  />
                </div>
              </>
            )}

            {sceneUsages.length > 0 && (
              <>
                <hr className={styles.divider} />
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Used as setting in {sceneUsages.length} scene{sceneUsages.length !== 1 ? "s" : ""}</label>
                  <div className={styles.usageList}>
                    {sceneUsages.map((u) => (
                      <div key={u.id} className={styles.usageItem}>
                        <MapPin size={12} color="var(--color-text-muted)" />
                        <span style={{ flex: 1 }}>Scene {u.node_id.slice(0, 8)}…</span>
                        <span className={styles.usageRole}>{u.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* AI panels */}
            {showAI === "what-exists" && (
              <WorldAIPanel
                title="What Would Exist Here?"
                description="Analyze this location's properties to surface questions about what would logically inhabit it — buildings, creatures, plants, and weather."
                buttonLabel="Analyze"
                requestId={`what-exists-${selected.id}`}
                onAnalyze={(signal) => api.analyzeLocationExistence(storyId, selected.id, signal)}
              />
            )}
            {showAI === "suggest" && (
              <WorldAIPanel
                title="AI Element Suggestions"
                description="Surface questions and directions for names, customs, creatures, and cultural elements rooted in this location's properties."
                buttonLabel="Suggest"
                requestId={`element-suggest-location-${selected.id}`}
                onAnalyze={(signal) => api.suggestWorldElements(storyId, "location", selected.id, signal)}
              />
            )}

            {/* Add child location shortcut */}
            <hr className={styles.divider} />
            <button
              className={styles.ghostBtn}
              onClick={() => { setNewParentId(selected.id); setShowAddModal(true); }}
            >
              <FolderPlus size={13} /> Add location inside "{selected.name}"
            </button>
          </>
        )}
      </div>

      {/* Add modal */}
      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {newParentId ? `Add location inside "${selected?.name}"` : "Add location"}
            </h3>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Name</label>
              <input
                className={styles.fieldInput}
                autoFocus
                placeholder="Location name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createLocation()}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Type</label>
              <TypeSelector
                value={newType}
                options={availableTypes}
                onChange={setNewType}
                predefined={PREDEFINED_TYPES}
              />
              {newType === "__custom__" && (
                <input
                  className={styles.fieldInput}
                  style={{ marginTop: "0.5rem" }}
                  placeholder="Enter custom type"
                  value={newCustomType}
                  onChange={(e) => setNewCustomType(e.target.value)}
                />
              )}
            </div>
            {!newParentId && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Parent location (optional)</label>
                <select
                  className={styles.fieldSelect}
                  value={newParentId ?? ""}
                  onChange={(e) => setNewParentId(e.target.value || null)}
                >
                  <option value="">None (root level)</option>
                  {flattenForSelect(locations).map(({ loc, depth }) => (
                    <option key={loc.id} value={loc.id}>
                      {"  ".repeat(depth)}{loc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className={styles.modalActions}>
              <button className={styles.ghostBtn} onClick={() => { setShowAddModal(false); setNewParentId(null); }}>Cancel</button>
              <button className={styles.addBtn} onClick={createLocation} disabled={!newName.trim()}>
                Add location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && selected && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Delete "{selected.name}"?</h3>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
              This will also delete all nested child locations. This cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.ghostBtn} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button
                className={styles.addBtn}
                style={{ background: "var(--color-danger)" }}
                onClick={deleteLocation}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline type selector with predefined + custom option
function TypeSelector({
  value, options, onChange, predefined,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  predefined: string[];
}) {
  const isCustom = value && !predefined.includes(value);
  const selectValue = isCustom ? "__custom__" : value;

  return (
    <select
      className={styles.fieldSelect}
      value={selectValue}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— select type —</option>
      {predefined.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
      {options.filter((t) => !predefined.includes(t)).map((t) => (
        <option key={t} value={t}>{t} (custom)</option>
      ))}
      <option value="__custom__">Custom…</option>
    </select>
  );
}
