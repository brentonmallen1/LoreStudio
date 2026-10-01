import { useCallback, useEffect, useState } from "react";
import { Compass, Cpu, Loader2 } from "lucide-react";
import { api } from "../../api/client";
import { codexApi, type CodexIndexStats, type CodexSettings } from "../../api/codex";
import { useJobs } from "../../hooks/useJobs";
import { useStoryStore } from "../../stores/storyStore";
import styles from "./CodexSection.module.css";

/** Embedding models worth suggesting when Ollama has not been asked yet. */
const SUGGESTED = ["nomic-embed-text", "mxbai-embed-large", "all-minilm"];

const CODEX_JOB_KINDS = ["codex-sync", "codex-index"];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Settings › Codex (doc 07 §6): which model makes the vectors, and what the index holds.
 *
 * The one thing this page must not do is describe a system that is not running. Every
 * number comes from the database, and the search backend line reports what will actually
 * answer the next query rather than what was configured.
 */
export default function CodexSection() {
  const { stories, setStories } = useStoryStore();
  const [settings, setSettings] = useState<CodexSettings | null>(null);
  const [model, setModel] = useState("");
  const [chosenStoryId, setChosenStoryId] = useState("");
  const [stats, setStats] = useState<CodexIndexStats | null>(null);
  const [installed, setInstalled] = useState<string[]>([]);
  // Derived, not stored: a default that lives in state has to be kept in step with the
  // story list, and "the first story until you pick another" needs no keeping in step.
  const storyId = chosenStoryId || stories[0]?.id || "";
  const { jobs, refresh: refreshJobs } = useJobs(storyId || undefined, !!storyId);

  // The story list is loaded by the dashboard. Opened straight to Settings — a new tab, a
  // reload, a deep link — it was empty, and this section said "No stories yet" and could
  // index nothing.
  useEffect(() => {
    if (stories.length) return;
    let live = true;
    api
      .listStories()
      .then((list) => live && setStories(list))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [stories.length, setStories]);

  const running = jobs.filter(
    (j) => CODEX_JOB_KINDS.includes(j.kind) && (j.status === "queued" || j.status === "running"),
  );

  useEffect(() => {
    codexApi
      .settings()
      .then((s) => {
        setSettings(s);
        setModel(s.embed_model ?? "");
      })
      .catch(() => setSettings(null));
    api
      .ollamaModels()
      .then((d) => setInstalled(d.models.map((m: { name: string }) => m.name)))
      .catch(() => setInstalled([]));
  }, []);

  const loadStats = useCallback(() => {
    if (!storyId) return;
    codexApi
      .indexStats(storyId)
      .then(setStats)
      .catch(() => setStats(null));
  }, [storyId]);

  useEffect(loadStats, [loadStats]);
  // A finished job changes the numbers, so re-read them when the queue drains.
  useEffect(() => {
    if (running.length === 0) loadStats();
  }, [running.length, loadStats]);

  async function saveModel(next: string) {
    setModel(next);
    const saved = await codexApi.updateSettings(next.trim() || null);
    setSettings(saved);
  }

  async function queue(kind: "sync" | "index") {
    if (!storyId) return;
    await (kind === "sync" ? codexApi.sync(storyId) : codexApi.reindex(storyId));
    refreshJobs();
  }

  return (
    <>
      <div className={styles.card}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="codex-embed-model">
            Embedding model
          </label>
          <input
            id="codex-embed-model"
            className={styles.input}
            list="codex-embed-models"
            value={model}
            placeholder={settings?.effective_embed_model ?? "nomic-embed-text"}
            onChange={(e) => setModel(e.target.value)}
            onBlur={(e) => saveModel(e.target.value)}
            spellCheck={false}
          />
          <datalist id="codex-embed-models">
            {[...new Set([...installed, ...SUGGESTED])].map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        <p className={styles.hint}>
          Turns your prose into vectors so the Codex can find passages by meaning rather than by keyword. It
          runs on your Ollama, like everything else. Changing the model does not re-embed anything on its own:
          vectors remember which model made them, and the next index run replaces the ones that no longer
          match.
        </p>
        <div className={styles.groundTruth}>
          <Cpu size={13} className={styles.groundTruthIcon} />
          <span>
            Search runs through{" "}
            {settings?.search_backend === "sqlite-vec" ? "sqlite-vec" : "Python (sqlite-vec not loaded)"}
          </span>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="codex-story">
            Story
          </label>
          <select
            id="codex-story"
            className={styles.select}
            value={storyId}
            onChange={(e) => setChosenStoryId(e.target.value)}
          >
            {stories.length === 0 && <option value="">No stories yet</option>}
            {stories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{stats?.chunks ?? "—"}</span>
            <span className={styles.statLabel}>Passages</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{stats?.embedded ?? "—"}</span>
            <span className={styles.statLabel}>Embedded</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{stats?.pending ?? "—"}</span>
            <span className={styles.statLabel}>Pending</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{stats ? formatBytes(stats.bytes) : "—"}</span>
            <span className={styles.statLabel}>Vectors</span>
          </div>
        </div>

        <p className={styles.hint}>
          {stats && stats.chunks === 0
            ? "Nothing indexed yet. Passages hang off the knowledge graph, so build the graph first, then index."
            : `Indexed with ${stats?.models.join(", ") || stats?.effective_embed_model || "—"}${
                stats?.dim ? ` · ${stats.dim} dimensions` : ""
              }.`}
        </p>

        <div className={styles.actions}>
          <button
            className={styles.secondaryBtn}
            onClick={() => queue("sync")}
            disabled={!storyId || running.length > 0}
            type="button"
          >
            Rebuild graph
          </button>
          <button
            className={styles.actionBtn}
            onClick={() => queue("index")}
            disabled={!storyId || running.length > 0}
            type="button"
          >
            <Compass size={13} />
            Index story
          </button>
          {running.length > 0 && (
            <span className={styles.running}>
              <Loader2 size={12} className={styles.spin} /> {running[0].label}: {running[0].progress}/
              {running[0].total || "?"}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
