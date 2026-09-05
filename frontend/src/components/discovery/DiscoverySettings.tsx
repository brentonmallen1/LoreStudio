import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import styles from "./DiscoverySettings.module.css";

const ELEMENT_TYPE_OPTIONS = [
  { value: "character", label: "👤 Characters" },
  { value: "setting", label: "📍 Settings" },
  { value: "relationship", label: "🔗 Relationships" },
  { value: "theme", label: "💡 Themes" },
  { value: "object", label: "📦 Objects" },
];

export default function DiscoverySettings({ storyId }: { storyId: string }) {
  const { activeStory, setActiveStory } = useStoryStore();
  if (!activeStory) return null;

  async function patch(
    changes: Partial<{
      discovery_enabled: boolean;
      discovery_auto_analyze: boolean;
      discovery_element_types: string[];
      discovery_min_confidence: number;
    }>,
  ) {
    const updated = await api.updateStory(storyId, changes);
    setActiveStory(updated);
  }

  const enabled = activeStory.discovery_enabled;
  const types = activeStory.discovery_element_types ?? ["character", "setting", "relationship"];
  const confidence = activeStory.discovery_min_confidence ?? 0.6;
  const confidenceLabel = confidence >= 0.8 ? "High" : confidence >= 0.6 ? "Medium" : "Low";

  function toggleType(type: string) {
    const next = types.includes(type) ? types.filter((t) => t !== type) : [...types, type];
    if (next.length === 0) return; // always keep at least one
    patch({ discovery_element_types: next });
  }

  return (
    <div className={styles.wrap}>
      {/* Master toggle */}
      <div className={styles.row}>
        <div>
          <p className={styles.label}>Enable discovery features</p>
          <p className={styles.hint}>Analyze prose for new story elements</p>
        </div>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => patch({ discovery_enabled: e.target.checked })}
          />
          <span className={styles.slider} />
        </label>
      </div>

      {/* Auto-analyze */}
      <div className={`${styles.row} ${!enabled ? styles.disabled : ""}`}>
        <div>
          <p className={styles.label}>Auto-analyze on save</p>
          <p className={styles.hint}>Runs in background after every content save</p>
        </div>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={activeStory.discovery_auto_analyze}
            onChange={(e) => patch({ discovery_auto_analyze: e.target.checked })}
            disabled={!enabled}
          />
          <span className={styles.slider} />
        </label>
      </div>

      {/* Element types */}
      <div className={`${styles.section} ${!enabled ? styles.disabled : ""}`}>
        <p className={styles.sectionTitle}>Look for</p>
        <div className={styles.checkboxGroup}>
          {ELEMENT_TYPE_OPTIONS.map((opt) => (
            <label key={opt.value} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={types.includes(opt.value)}
                onChange={() => toggleType(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Confidence threshold */}
      <div className={`${styles.section} ${!enabled ? styles.disabled : ""}`}>
        <p className={styles.sectionTitle}>Minimum confidence — {confidenceLabel}</p>
        <div className={styles.confidenceRow}>
          <input
            type="range"
            className={styles.confidenceSlider}
            min={0.3}
            max={0.9}
            step={0.1}
            value={confidence}
            onChange={(e) => patch({ discovery_min_confidence: parseFloat(e.target.value) })}
          />
          <div className={styles.confidenceLabels}>
            <span>Catch more (lower bar)</span>
            <span>High certainty only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
