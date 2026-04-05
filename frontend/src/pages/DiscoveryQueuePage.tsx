import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Settings, Telescope } from "lucide-react";
import { useStoryStore } from "../stores/storyStore";
import { useDiscoveryStore } from "../stores/discoveryStore";
import DiscoveryCard from "../components/discovery/DiscoveryCard";
import DiscoverySettings from "../components/discovery/DiscoverySettings";
import type { StructureNode } from "../types";
import styles from "./DiscoveryQueuePage.module.css";

function flattenLeaves(nodes: StructureNode[]): StructureNode[] {
  const out: StructureNode[] = [];
  function walk(n: StructureNode) {
    if (n.children.length === 0) out.push(n);
    else n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return out;
}

type TypeFilter = "all" | "character" | "setting" | "relationship" | "theme" | "object";

export default function DiscoveryQueuePage() {
  const { storyId } = useParams<{ storyId: string }>();
  const { activeStory, structure } = useStoryStore();
  const {
    discoveries,
    pendingCount,
    isAnalyzing,
    loadDiscoveries,
    runDiscovery,
    approveDiscovery,
    rejectDiscovery,
  } = useDiscoveryStore();

  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedSceneId, setSelectedSceneId] = useState<string>("");

  useEffect(() => {
    if (!storyId) return;
    setLoading(true);
    loadDiscoveries(storyId).finally(() => setLoading(false));
  }, [storyId]);

  if (!storyId || !activeStory) return null;

  const enabled = activeStory.discovery_enabled;
  const scenes = flattenLeaves(structure);

  async function handleAnalyze() {
    if (!storyId) return;
    await runDiscovery(storyId, selectedSceneId || undefined);
  }

  const filtered = typeFilter === "all"
    ? discoveries
    : discoveries.filter(d => d.element_type === typeFilter);

  const typeCounts: Record<string, number> = {};
  for (const d of discoveries) {
    typeCounts[d.element_type] = (typeCounts[d.element_type] ?? 0) + 1;
  }

  const filterOptions: { value: TypeFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "character", label: "👤 Characters" },
    { value: "setting", label: "📍 Settings" },
    { value: "relationship", label: "🔗 Relationships" },
    { value: "theme", label: "💡 Themes" },
    { value: "object", label: "📦 Objects" },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Discoveries</h2>
          {pendingCount > 0 && (
            <span className={styles.badge}>{pendingCount}</span>
          )}
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.settingsBtn}
            onClick={() => setSettingsOpen(v => !v)}
            title="Discovery settings"
          >
            <Settings size={13} />
            Settings
          </button>
        </div>
      </div>

      {enabled && (
        <div className={styles.analyzeBar}>
          <select
            className={styles.sceneSelect}
            value={selectedSceneId}
            onChange={e => setSelectedSceneId(e.target.value)}
          >
            <option value="">Entire story (recent scenes)</option>
            {scenes.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          <button
            className={styles.analyzeBtn}
            onClick={handleAnalyze}
            disabled={isAnalyzing}
          >
            <Telescope size={13} />
            {isAnalyzing ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      )}

      {settingsOpen && (
        <div className={styles.settingsPanel}>
          <p className={styles.settingsPanelTitle}>Discovery Settings</p>
          <DiscoverySettings storyId={storyId} />
        </div>
      )}

      {!enabled ? (
        <div className={styles.disabledNote}>
          <span className={styles.emptyIcon}>🔭</span>
          <p>Discovery is disabled for this story.</p>
          <p>Enable it in Settings above to start observing your prose for new story elements.</p>
        </div>
      ) : loading ? (
        <div className={styles.loading}>Loading discoveries…</div>
      ) : (
        <>
          {isAnalyzing && (
            <div className={styles.analyzingNote}>
              <span className={styles.analyzingDot} />
              Analyzing prose for new elements…
            </div>
          )}

          {discoveries.length > 0 && (
            <div className={styles.filterRow}>
              {filterOptions.map(opt => {
                const count = opt.value === "all" ? discoveries.length : typeCounts[opt.value];
                if (opt.value !== "all" && !count) return null;
                return (
                  <button
                    key={opt.value}
                    className={`${styles.filterBtn} ${typeFilter === opt.value ? styles.filterBtnActive : ""}`}
                    onClick={() => setTypeFilter(opt.value)}
                  >
                    {opt.label}
                    {count ? <span className={styles.filterCount}>({count})</span> : null}
                  </button>
                );
              })}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>🔭</span>
              <p className={styles.emptyTitle}>
                {discoveries.length === 0 ? "Queue is clear" : "No matches"}
              </p>
              <p className={styles.emptyText}>
                {discoveries.length === 0
                  ? "Select a scene above and click Analyze to find new story elements in your prose."
                  : "Try a different filter."}
              </p>
            </div>
          ) : (
            <div className={styles.queue}>
              {filtered.map(element => (
                <DiscoveryCard
                  key={element.id}
                  element={element}
                  onApprove={approveDiscovery}
                  onReject={rejectDiscovery}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
