import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Network } from "lucide-react";
import AIFeatureInfoTrigger from "../components/ai/AIFeatureInfoTrigger";
import CodexGraphView from "../components/codex/CodexGraphView";
import CodexNodePanel from "../components/codex/CodexNodePanel";
import CodexReviewQueue from "../components/codex/CodexReviewQueue";
import { codexApi, type CodexGraph } from "../api/codex";
import styles from "./CodexPage.module.css";

type Tab = "review" | "graph";

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

  useEffect(() => {
    if (tab === "graph") loadGraph();
  }, [tab, loadGraph]);

  if (!storyId) return null;

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
            {graph && <CodexGraphView graph={graph} selectedId={selectedNode} onSelect={setSelectedNode} />}
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
