import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Network, RefreshCw } from "lucide-react";
import AIFeatureInfoTrigger from "../components/ai/AIFeatureInfoTrigger";
import CodexGraphView from "../components/codex/CodexGraphView";
import CodexNodePanel from "../components/codex/CodexNodePanel";
import CodexReviewQueue from "../components/codex/CodexReviewQueue";
import { codexApi, type CodexGraph } from "../api/codex";
import { ACTIVE_JOB_STATUSES } from "../api/jobs";
import { useJobs } from "../hooks/useJobs";
import styles from "./CodexPage.module.css";

type Tab = "review" | "graph";

const BUILD_JOB = "codex-sync";

const TABS: { id: Tab; label: string }[] = [
  { id: "review", label: "Review" },
  { id: "graph", label: "Graph" },
];

/**
 * Codex (doc 07 §6): the review queue, and the graph it feeds.
 *
 * Two views of one thing. The queue is where the author answers proposals; the graph is
 * where they see what the answers built — with anything still unanswered drawn dashed, so
 * the picture never claims more than the data supports.
 */
export default function CodexPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const [tab, setTab] = useState<Tab>("review");
  const [graph, setGraph] = useState<CodexGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const loadGraph = useCallback(() => {
    if (!storyId) return;
    codexApi
      .graph(storyId)
      .then(setGraph)
      .catch(() => setGraph({ nodes: [], edges: [], counts: {} }));
  }, [storyId]);

  // The graph is rebuilt on request, not as you write, so the button lives on the graph
  // itself. It used to live only in Settings › Codex, and the empty state sent you there.
  const { jobs, refresh: refreshJobs } = useJobs(storyId, !!storyId && tab === "graph");
  const lastBuild = jobs.find((j) => j.kind === BUILD_JOB);
  const building = lastBuild && ACTIVE_JOB_STATUSES.includes(lastBuild.status) ? lastBuild : undefined;
  const buildingId = building?.id;

  // Loads on opening the tab, and again when a build finishes.
  useEffect(() => {
    if (tab === "graph" && !buildingId) loadGraph();
  }, [tab, buildingId, loadGraph]);

  async function build() {
    if (!storyId) return;
    await codexApi.sync(storyId);
    refreshJobs();
  }

  if (!storyId) return null;

  const empty = graph !== null && graph.nodes.length === 0;
  const buildLabel = empty ? "Build the graph" : "Rebuild graph";

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Network size={18} color="var(--color-ai)" />
        <h1 className={styles.title}>Codex</h1>
        <AIFeatureInfoTrigger pageId="codex" />
      </div>

      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={styles.tab}
            data-on={tab === t.id}
            onClick={() => setTab(t.id)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "review" ? (
        <CodexReviewQueue storyId={storyId} />
      ) : (
        <div className={styles.graphLayout}>
          <div className={styles.graphMain}>
            {graph === null ? (
              <p className={styles.loading}>Loading the graph…</p>
            ) : (
              <>
                {!empty && (
                  <div className={styles.toolbar}>
                    <button className={styles.bulkBtn} onClick={build} disabled={!!building} type="button">
                      <RefreshCw size={12} />
                      {buildLabel}
                    </button>
                    <BuildStatus
                      building={building}
                      failed={lastBuild?.status === "error" ? lastBuild.error : null}
                    />
                  </div>
                )}
                <CodexGraphView
                  graph={graph}
                  selectedId={selectedNode}
                  onSelect={setSelectedNode}
                  emptyAction={
                    <div className={styles.emptyBuild}>
                      <button className={styles.buildBtn} onClick={build} disabled={!!building} type="button">
                        <Network size={13} />
                        {buildLabel}
                      </button>
                      <BuildStatus
                        building={building}
                        failed={lastBuild?.status === "error" ? lastBuild.error : null}
                      />
                    </div>
                  }
                />
              </>
            )}
          </div>
          {selectedNode && (
            <aside className={styles.graphSide}>
              <CodexNodePanel
                storyId={storyId}
                nodeId={selectedNode}
                onSelect={setSelectedNode}
                onClose={() => setSelectedNode(null)}
              />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

function BuildStatus({ building, failed }: { building?: { label: string }; failed: string | null }) {
  if (building) {
    return (
      <span className={styles.running}>
        <Loader2 size={12} className={styles.spin} />
        Building…
      </span>
    );
  }
  if (failed) return <span className={styles.buildError}>The last build failed: {failed}</span>;
  return null;
}
