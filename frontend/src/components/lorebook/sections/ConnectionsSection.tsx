import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Network, RefreshCw } from "lucide-react";
import { codexApi, type CodexGraph } from "../../../api/codex";
import { ACTIVE_JOB_STATUSES } from "../../../api/jobs";
import { useJobs } from "../../../hooks/useJobs";
import { isProposal } from "../../../lib/graph/codexVocabulary";
import { useAIAvailable } from "../../../lib/mode";
import CodexGraphView from "../../codex/CodexGraphView";
import CodexNodePanel from "../../codex/CodexNodePanel";
import styles from "./Connections.module.css";

const BUILD_JOB = "codex-sync";

/**
 * Connections (doc 12 P5): the Codex graph as a Lorebook section, beside the entries it
 * connects. Anything the model proposed and the author has not answered is drawn dashed;
 * answering it happens in Proposals, with everything else waiting for a yes or no.
 * Building the graph uses no AI, so Writer mode has it too (doc 13 D2), without the
 * model's proposals.
 */
export default function ConnectionsSection({ storyId }: { storyId: string }) {
  const [loaded, setLoaded] = useState<CodexGraph | null>(null);
  const aiAvailable = useAIAvailable();
  const graph = useMemo(
    () =>
      loaded && !aiAvailable
        ? {
            ...loaded,
            nodes: loaded.nodes.filter((n) => !isProposal(n.props.source as string)),
            edges: loaded.edges.filter((e) => !isProposal(e.source)),
          }
        : loaded,
    [loaded, aiAvailable],
  );
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const loadGraph = useCallback(() => {
    codexApi
      .graph(storyId)
      .then(setLoaded)
      .catch(() => setLoaded({ nodes: [], edges: [], counts: {} }));
  }, [storyId]);

  // The graph is rebuilt on request, not as you write, so the button lives on the graph.
  const { jobs, refresh: refreshJobs } = useJobs(storyId, true);
  const lastBuild = jobs.find((j) => j.kind === BUILD_JOB);
  const building = lastBuild && ACTIVE_JOB_STATUSES.includes(lastBuild.status) ? lastBuild : undefined;
  const buildingId = building?.id;

  // Loads on arrival, and again when a build finishes.
  useEffect(() => {
    if (!buildingId) loadGraph();
  }, [buildingId, loadGraph]);

  async function build() {
    await codexApi.sync(storyId);
    refreshJobs();
  }

  const empty = graph !== null && graph.nodes.length === 0;
  const buildLabel = empty ? "Build the graph" : "Rebuild graph";
  const failed = lastBuild?.status === "error" ? lastBuild.error : null;

  return (
    <div className={styles.graphLayout}>
      <div className={styles.graphMain}>
        {graph === null ? (
          <p className={styles.loading}>Loading the graph…</p>
        ) : (
          <>
            {!empty && (
              <div className={styles.toolbar}>
                <button className={styles.bulkBtn} onClick={build} disabled={!!building} type="button">
                  <RefreshCw size={12} aria-hidden />
                  {buildLabel}
                </button>
                <BuildStatus building={building} failed={failed} />
              </div>
            )}
            <CodexGraphView
              graph={graph}
              selectedId={selectedNode}
              onSelect={setSelectedNode}
              emptyAction={
                <div className={styles.emptyBuild}>
                  <button className={styles.buildBtn} onClick={build} disabled={!!building} type="button">
                    <Network size={13} aria-hidden />
                    {buildLabel}
                  </button>
                  <BuildStatus building={building} failed={failed} />
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
            showAI={aiAvailable}
            nodeId={selectedNode}
            onSelect={setSelectedNode}
            onClose={() => setSelectedNode(null)}
          />
        </aside>
      )}
    </div>
  );
}

function BuildStatus({ building, failed }: { building?: { label: string }; failed: string | null }) {
  if (building) {
    return (
      <span className={styles.running}>
        <Loader2 size={12} className={styles.spin} aria-hidden />
        Building…
      </span>
    );
  }
  if (failed) return <span className={styles.buildError}>The last build failed: {failed}</span>;
  return null;
}
