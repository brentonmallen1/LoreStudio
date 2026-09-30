import SlotPicker from "../components/common/SlotPicker";
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapPin, Trash2, ArrowLeft, ExternalLink } from "lucide-react";
import { api } from "../api/client";
import type { Location } from "../types";
import { useStoryStore } from "../stores/storyStore";
import { SectionCard } from "../components/common";
import AssetPicker from "../components/media/AssetPicker";
import PortraitEditor from "../components/media/PortraitEditor";
import styles from "./LocationSheet.module.css";

const CELESTIAL_TYPES = new Set([
  "star_system",
  "star",
  "planet",
  "gas_giant",
  "moon",
  "asteroid_belt",
  "orbital_station",
  "space_habitat",
]);

export default function LocationSheet() {
  const { storyId, locationId } = useParams<{ storyId: string; locationId: string }>();
  const navigate = useNavigate();
  const { setActiveNode, structure } = useStoryStore();

  const [location, setLocation] = useState<Location | null>(null);
  const [parent, setParent] = useState<Location | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "scenes">("overview");
  const [scenes, setScenes] = useState<
    { scene_setting_id: string; scene_id: string; scene_title: string; role: string; notes: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState(false);

  const saveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    api
      .getLocation(locationId)
      .then((loc) => {
        setLocation(loc);
        if (loc.parent_id) {
          api
            .getLocation(loc.parent_id)
            .then(setParent)
            .catch(() => {});
        } else {
          setParent(null);
        }
      })
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    if (!locationId || activeTab !== "scenes") return;
    api
      .getScenesForLocation(locationId)
      .then(setScenes)
      .catch(() => {});
  }, [locationId, activeTab]);

  function patch(field: keyof Location, value: string) {
    if (!location) return;
    setLocation((prev) => (prev ? { ...prev, [field]: value } : prev));
    clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      api.updateLocation(location.id, { [field]: value });
    }, 700);
  }

  async function doDelete() {
    if (!location) return;
    setPendingDelete(false);
    await api.deleteLocation(location.id).catch(() => {});
    navigate(`/stories/${storyId}/worldbuilding`);
  }

  function navigateToScene(sceneId: string) {
    function findNode(nodes: typeof structure): (typeof structure)[0] | null {
      for (const n of nodes) {
        if (n.id === sceneId) return n;
        if (n.children) {
          const found = findNode(n.children);
          if (found) return found;
        }
      }
      return null;
    }
    const node = findNode(structure);
    if (node) setActiveNode(node);
    navigate(`/stories/${storyId}/write`);
  }

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (!location) return <div className={styles.loading}>Location not found.</div>;

  const isCelestial = CELESTIAL_TYPES.has(location.location_type);
  const descriptionTeaser =
    location.description.length > 90 ? location.description.slice(0, 90) + "…" : location.description;

  return (
    <div className={styles.page}>
      {/* ID Card Header */}
      <div className={styles.idCard}>
        <PortraitEditor
          storyId={storyId!}
          objectType="location"
          objectId={location.id}
          placeholder={<MapPin size={32} />}
        />
        <div className={styles.cardInfo}>
          <div className={styles.nameRow}>
            <button
              className={styles.backBtn}
              onClick={() => navigate(`/stories/${storyId}/worldbuilding`)}
              title="Back to World Building"
            >
              <ArrowLeft size={14} />
            </button>
            <h1 className={styles.name}>{location.name}</h1>
            {location.location_type && (
              <span className={styles.typeBadge}>{location.location_type.replace(/_/g, " ")}</span>
            )}
            <SlotPicker
              size="sm"
              value={location.color_slot}
              onChange={(slot) =>
                api.updateLocation(location.id, { color_slot: slot }).then((saved) => {
                  setLocation(saved);
                  useStoryStore.getState().upsertLocation(saved);
                })
              }
            />
          </div>
          {parent && (
            <p className={styles.breadcrumb}>
              <MapPin size={11} />
              {parent.name}
            </p>
          )}
          {location.description && <p className={styles.descTeaser}>"{descriptionTeaser}"</p>}
        </div>
        <div className={styles.actions}>
          {pendingDelete ? (
            <div className={styles.deleteConfirm}>
              <button className={styles.deleteConfirmYes} onClick={doDelete}>
                Delete
              </button>
              <button className={styles.deleteConfirmNo} onClick={() => setPendingDelete(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              className={styles.deleteBtn}
              onClick={() => setPendingDelete(true)}
              title="Delete location"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "overview" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={`${styles.tab} ${activeTab === "scenes" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("scenes")}
        >
          Scenes
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.content}>
        {activeTab === "overview" && (
          <div className={styles.overviewGrid}>
            <SectionCard title="Description">
              <textarea
                className={styles.textarea}
                value={location.description}
                onChange={(e) => patch("description", e.target.value)}
                placeholder="Describe this location…"
                rows={4}
              />
            </SectionCard>
            <SectionCard title="Atmosphere">
              <textarea
                className={styles.textarea}
                value={location.atmosphere}
                onChange={(e) => patch("atmosphere", e.target.value)}
                placeholder="Mood and ambiance…"
                rows={3}
              />
            </SectionCard>
            <SectionCard title="History">
              <textarea
                className={styles.textarea}
                value={location.history}
                onChange={(e) => patch("history", e.target.value)}
                placeholder="Historical background…"
                rows={3}
              />
            </SectionCard>
            <SectionCard title="Significance">
              <textarea
                className={styles.textarea}
                value={location.significance}
                onChange={(e) => patch("significance", e.target.value)}
                placeholder="Why does this place matter to the story?"
                rows={3}
              />
            </SectionCard>
            <SectionCard title="Physical Details">
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Climate</label>
                  <input
                    className={styles.input}
                    value={location.climate}
                    onChange={(e) => patch("climate", e.target.value)}
                    placeholder="e.g. temperate, arctic…"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Terrain</label>
                  <input
                    className={styles.input}
                    value={location.terrain}
                    onChange={(e) => patch("terrain", e.target.value)}
                    placeholder="e.g. mountainous, coastal…"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Political Affiliation</label>
                  <input
                    className={styles.input}
                    value={location.political_affiliation}
                    onChange={(e) => patch("political_affiliation", e.target.value)}
                    placeholder="Faction, nation, allegiance…"
                  />
                </div>
              </div>
            </SectionCard>
            {isCelestial && (
              <SectionCard title="Celestial Properties">
                <div className={styles.fieldGrid}>
                  <div className={styles.field}>
                    <label className={styles.label}>Orbital Period</label>
                    <input
                      className={styles.input}
                      value={location.orbital_period}
                      onChange={(e) => patch("orbital_period", e.target.value)}
                      placeholder="e.g. 365 Earth days"
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Distance from Parent</label>
                    <input
                      className={styles.input}
                      value={location.distance_from_parent}
                      onChange={(e) => patch("distance_from_parent", e.target.value)}
                      placeholder="e.g. 1 AU"
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Gravity</label>
                    <input
                      className={styles.input}
                      value={location.gravity}
                      onChange={(e) => patch("gravity", e.target.value)}
                      placeholder="e.g. 0.8g"
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Habitability</label>
                    <input
                      className={styles.input}
                      value={location.habitability}
                      onChange={(e) => patch("habitability", e.target.value)}
                      placeholder="e.g. breathable, hostile"
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Radiation Level</label>
                    <input
                      className={styles.input}
                      value={location.radiation_level}
                      onChange={(e) => patch("radiation_level", e.target.value)}
                      placeholder="e.g. low, lethal"
                    />
                  </div>
                </div>
              </SectionCard>
            )}
            <SectionCard title="Reference Images">
              <AssetPicker storyId={storyId!} objectType="location" objectId={location.id} />
            </SectionCard>
          </div>
        )}

        {activeTab === "scenes" && (
          <div className={styles.sceneList}>
            {scenes.length === 0 ? (
              <p className={styles.empty}>
                No scenes use this location yet. Add scene settings from the World Building panel.
              </p>
            ) : (
              scenes.map((s) => (
                <div key={s.scene_setting_id} className={styles.sceneRow}>
                  <div className={styles.sceneInfo}>
                    <span className={styles.sceneTitle}>{s.scene_title}</span>
                    <span className={`${styles.roleBadge} ${styles[s.role] ?? ""}`}>{s.role}</span>
                  </div>
                  <button
                    className={styles.sceneNavBtn}
                    onClick={() => navigateToScene(s.scene_id)}
                    title="Go to scene"
                  >
                    <ExternalLink size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
