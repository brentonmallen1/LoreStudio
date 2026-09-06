import { useCallback, useEffect, useState } from "react";
import { Check, Compass, Loader2, Network, X } from "lucide-react";
import { codexApi, type CodexSuggestion } from "../../api/codex";
import { useJobs } from "../../hooks/useJobs";
import styles from "../../pages/CodexPage.module.css";

const SUGGEST_JOB = "codex-suggest";

const KIND_LABELS: Record<string, string> = {
  presence: "Who is here",
  fact: "Establishes",
};

function groupByScene(suggestions: CodexSuggestion[]): [string, CodexSuggestion[]][] {
  const groups = new Map<string, CodexSuggestion[]>();
  for (const s of suggestions) {
    const key = s.scene_title || "Elsewhere";
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.entries()];
}

/**
 * The Codex review queue (doc 07 §6).
 *
 * Every row is a proposal with the line it was read from, because the author should be
 * checking a citation rather than trusting a claim. Nothing here has any effect on the
 * story until it is confirmed — and confirming writes a real Lorebook row, not a blessed
 * guess, so the graph never holds the only copy of something the author agreed to.
 */
export default function CodexReviewQueue({ storyId }: { storyId: string }) {
  // null until the first load answers: an empty queue and an unloaded one look the same
  // otherwise, and the empty state tells the author to go run the pass.
  const [suggestions, setSuggestions] = useState<CodexSuggestion[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { jobs, refresh: refreshJobs } = useJobs(storyId, !!storyId);

  const running = jobs.find(
    (j) => j.kind === SUGGEST_JOB && (j.status === "queued" || j.status === "running"),
  );

  const load = useCallback(() => {
    if (!storyId) return;
    codexApi
      .suggestions(storyId)
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  }, [storyId]);

  useEffect(load, [load]);
  // A finished pass has new proposals in it.
  useEffect(() => {
    if (!running) load();
  }, [running, load]);

  async function decide(ids: string[], accept: boolean) {
    if (!storyId || ids.length === 0) return;
    await codexApi.review(storyId, ids, accept);
    setSelected(new Set());
    load();
  }

  async function runPass() {
    if (!storyId) return;
    await codexApi.suggest(storyId);
    refreshJobs();
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedIds = [...selected];

  return (
    <>
      <p className={styles.intro}>
        The Codex works out who is in a scene from point of view, dialogue tags and names in the prose. Good
        writing defeats all three — you write "the keeper", not "Elena". This pass reads your scenes and
        proposes what those three signals missed, quoting the line it read it from. Nothing here counts until
        you confirm it.
      </p>

      <div className={styles.toolbar}>
        <button className={styles.runBtn} onClick={runPass} disabled={!!running} type="button">
          <Compass size={13} />
          Read the manuscript
        </button>
        {running && (
          <span className={styles.running}>
            <Loader2 size={12} className={styles.spin} />
            Reading — {running.progress}/{running.total || "?"} scenes
          </span>
        )}
        <span className={styles.spacer} />
        <button
          className={styles.bulkBtn}
          onClick={() => decide(selectedIds, true)}
          disabled={selectedIds.length === 0}
          type="button"
        >
          <Check size={12} />
          Confirm {selectedIds.length || ""}
        </button>
        <button
          className={styles.bulkBtn}
          onClick={() => decide(selectedIds, false)}
          disabled={selectedIds.length === 0}
          type="button"
        >
          <X size={12} />
          Reject {selectedIds.length || ""}
        </button>
      </div>

      {suggestions === null ? null : suggestions.length === 0 ? (
        <div className={styles.empty}>
          <Network size={28} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Nothing waiting on you</p>
          <p className={styles.emptyHint}>
            Run the pass after you have written a few scenes. It only proposes indexing — who was present,
            what a scene establishes — never what should happen next.
          </p>
        </div>
      ) : (
        groupByScene(suggestions).map(([scene, rows]) => (
          <section key={scene} className={styles.sceneGroup}>
            <h2 className={styles.sceneTitle}>{scene}</h2>
            {rows.map((s) => (
              <div key={s.id} className={styles.card}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  aria-label={s.statement}
                />
                <div className={styles.body}>
                  <div className={styles.statementRow}>
                    <span className={styles.kindTag}>{KIND_LABELS[s.kind] ?? s.kind}</span>
                    <span className={styles.statement}>{s.statement}</span>
                    <span className={styles.confidence}>{Math.round(s.confidence * 100)}%</span>
                  </div>
                  {s.quote && <p className={styles.quote}>"{s.quote}"</p>}
                </div>
                <div className={styles.actions}>
                  <button className={styles.confirmBtn} onClick={() => decide([s.id], true)} type="button">
                    <Check size={12} />
                    Confirm
                  </button>
                  <button className={styles.rejectBtn} onClick={() => decide([s.id], false)} type="button">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </section>
        ))
      )}
    </>
  );
}
