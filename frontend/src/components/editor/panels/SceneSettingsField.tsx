import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { api } from "../../../api/client";
import type { Location, SceneSetting, StructureNode } from "../../../types";
import styles from "../SceneEditor.module.css";

const smallSelect: React.CSSProperties = {
  fontSize: "0.72rem",
  fontFamily: "inherit",
  padding: "0.15rem 0.3rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text-muted)",
  cursor: "pointer",
};

/** Locations linked to this scene (primary / mentioned / flashback). */
export default function SceneSettingsField({
  activeNode,
  locations,
}: {
  activeNode: StructureNode;
  locations: Location[];
}) {
  const [settings, setSettings] = useState<SceneSetting[]>([]);
  const [addId, setAddId] = useState("");
  const [addRole, setAddRole] = useState("primary");

  useEffect(() => {
    api
      .getSceneSettingsForNode(activeNode.id)
      .then(setSettings)
      .catch(() => {});
  }, [activeNode.id]);

  async function add() {
    if (!addId) return;
    const created = await api.addSceneSetting({ location_id: addId, node_id: activeNode.id, role: addRole });
    setSettings((prev) => [...prev, created]);
    setAddId("");
  }

  async function remove(id: string) {
    await api.removeSceneSetting(id);
    setSettings((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div className={styles.overviewField}>
      <div className={styles.linkedHeader}>
        <label className={styles.overviewLabel}>Settings</label>
        <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
          <select value={addRole} onChange={(e) => setAddRole(e.target.value)} style={smallSelect}>
            <option value="primary">Primary</option>
            <option value="mentioned">Mentioned</option>
            <option value="flashback">Flashback</option>
          </select>
          <select value={addId} onChange={(e) => setAddId(e.target.value)} style={smallSelect}>
            <option value="">Add location…</option>
            {locations
              .filter((loc) => !settings.some((s) => s.location_id === loc.id))
              .map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
          </select>
          <button className={styles.addLinkBtn} disabled={!addId} onClick={add}>
            <Plus size={11} />
          </button>
        </div>
      </div>
      {settings.length === 0 ? (
        <p className={styles.overviewHint}>No locations linked to this scene yet.</p>
      ) : (
        <div className={styles.linkChips}>
          {settings.map((s) => {
            const loc = locations.find((l) => l.id === s.location_id);
            return (
              <div key={s.id} className={styles.linkChip}>
                <span className={styles.linkChipContent} style={{ cursor: "default" }}>
                  {s.role !== "primary" && <span className={styles.linkChipLabel}>{s.role}</span>}
                  <span className={styles.linkChipTitle}>{loc?.name ?? s.location_id}</span>
                </span>
                <button
                  className={styles.linkChipDelete}
                  onClick={() => remove(s.id)}
                  title="Remove location"
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
