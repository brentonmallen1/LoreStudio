import { useState, useEffect, useRef } from "react";
import { Compass, Square, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { ActivityLog } from "../../types";
import { ContextLevelSelector, type ContextLevel } from "./ContextLevelSelector";
import { ScopeSelector, type ScopeSelection } from "./ScopeSelector";
import { EditorialReportCard } from "./EditorialReportCard";
import styles from "./EditorView.module.css";

interface Props {
  storyId: string;
}

export function EditorView({ storyId }: Props) {
  const structure = useStoryStore((s) => s.structure);

  const [contextLevel, setContextLevel] = useState<ContextLevel>("summaries");
  const [scope, setScope] = useState<ScopeSelection>({ type: "story", ids: [] });
  const [reports, setReports] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClearNotes, setConfirmClearNotes] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getEditorialReports(storyId).then((data) => {
      if (!cancelled) {
        setReports(data);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [storyId]);

  async function runPass() {
    setError(null);
    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const log = await api.runEditorialPass(
        storyId,
        contextLevel,
        scope.type,
        scope.ids,
        controller.signal,
      );
      setReports((prev) => [log, ...prev]);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        // user cancelled
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("No written content")) {
          setError("No written content found in the selected scope. Write some scenes first.");
        } else if (msg.includes("context window") || msg.includes("context_length")) {
          setError("The content exceeds your model's context window. Try 'With Summaries' mode or reduce the scope.");
        } else if (msg.includes("timeout") || msg.includes("timed out")) {
          setError("Analysis timed out. Your model may need more resources, or try a smaller scope.");
        } else if (msg.includes("connect") || msg.includes("fetch")) {
          setError("Could not reach Ollama. Ensure it is running and check your connection settings.");
        } else {
          setError(msg || "An unexpected error occurred.");
        }
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function handleDelete(reportId: string) {
    await api.deleteEditorialReport(storyId, reportId);
    setReports((prev) => prev.filter((r) => r.id !== reportId));
  }

  async function handleClearAllNotes() {
    await api.clearAllEditorialNotes(storyId);
    setConfirmClearNotes(false);
  }

  return (
    <div className={styles.root}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.controls}>
          <ContextLevelSelector value={contextLevel} onChange={setContextLevel} />
          <ScopeSelector structure={structure} value={scope} onChange={setScope} />
        </div>

        <div className={styles.actions}>
          {running ? (
            <button className={styles.stopBtn} onClick={stop}>
              <Square size={13} />
              Stop
            </button>
          ) : (
            <button className={styles.runBtn} onClick={runPass}>
              <Compass size={13} />
              Run Editor
            </button>
          )}
        </div>
      </div>

      {running && (
        <div className={styles.progressBanner}>
          <Loader2 size={13} className={styles.spinner} />
          <span>Running editorial pass — this may take a minute…</span>
        </div>
      )}

      {error && (
        <div className={styles.errorBanner}>
          <AlertTriangle size={13} />
          <span>{error}</span>
          <button className={styles.errorDismiss} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ── Report management actions ── */}
      {reports.length > 0 && (
        <div className={styles.reportActions}>
          <span className={styles.reportCount}>
            {reports.length} report{reports.length !== 1 ? "s" : ""}
          </span>
          <button
            className={styles.clearNotesBtn}
            onClick={() => setConfirmClearNotes(true)}
            title="Remove all editorial inline notes from the manuscript"
          >
            <Trash2 size={11} />
            Clear all editorial notes
          </button>
        </div>
      )}

      {confirmClearNotes && (
        <div className={styles.confirmBanner}>
          <span>Remove all editorial inline notes from every scene?</span>
          <button className={styles.confirmYes} onClick={handleClearAllNotes}>Clear notes</button>
          <button className={styles.confirmNo} onClick={() => setConfirmClearNotes(false)}>Cancel</button>
        </div>
      )}

      {/* ── Reports list ── */}
      {loading ? (
        <div className={styles.loadingState}>
          <Loader2 size={14} className={styles.spinner} />
          <span>Loading reports…</span>
        </div>
      ) : reports.length === 0 ? (
        <div className={styles.emptyState}>
          <Compass size={28} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>No editorial reports yet</p>
          <p className={styles.emptyHint}>
            Configure your context and scope above, then click <strong>Run Editor</strong> to get
            developmental feedback on your manuscript.
          </p>
        </div>
      ) : (
        <div className={styles.reportList}>
          {reports.map((log) => (
            <EditorialReportCard key={log.id} log={log} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
