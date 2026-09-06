import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { codexApi, type CodexEdgeDetail, type CodexNodeDetail } from "../../api/codex";
import { edgeLabel, isProposal, nodeColor, nodeLabel } from "../../lib/graph/codexVocabulary";
import styles from "./CodexNodePanel.module.css";

interface Props {
  storyId: string;
  nodeId: string;
  onSelect: (nodeId: string) => void;
  onClose: () => void;
}

function groupByKind(edges: CodexEdgeDetail[]): [string, CodexEdgeDetail[]][] {
  const groups = new Map<string, CodexEdgeDetail[]>();
  for (const edge of edges) {
    const key = `${edge.kind}:${edge.direction}`;
    groups.set(key, [...(groups.get(key) ?? []), edge]);
  }
  return [...groups.entries()];
}

/** "present in" from a scene's side is "who is present here". */
function heading(kind: string, direction: string): string {
  const label = edgeLabel(kind);
  return direction === "out" ? label : `${label} (incoming)`;
}

/**
 * One node: what it stands for, what it connects to, and how much it has been used.
 *
 * The "used in N AI calls" line is the honest answer to "is this infrastructure earning
 * its keep" — a node nothing has ever been sent about is a node the graph built for
 * nobody, and the author can see that rather than being told the Codex is working.
 */
export default function CodexNodePanel({ storyId, nodeId, onSelect, onClose }: Props) {
  const [detail, setDetail] = useState<CodexNodeDetail | null>(null);

  useEffect(() => {
    let live = true;
    codexApi
      .node(storyId, nodeId)
      .then((d) => live && setDetail(d))
      .catch(() => live && setDetail(null));
    return () => {
      live = false;
    };
  }, [storyId, nodeId]);

  if (!detail)
    return (
      <div className={styles.panel}>
        <p className={styles.empty}>Loading…</p>
      </div>
    );

  const { node } = detail;
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.kind} style={{ background: nodeColor(node.kind) }}>
          {nodeLabel(node.kind)}
        </span>
        <h2 className={styles.label}>{node.label}</h2>
        <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Close">
          <X size={15} />
        </button>
      </div>

      {node.summary && <p className={styles.summary}>{node.summary}</p>}

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{detail.edges.length}</span>
          <span className={styles.statLabel}>Connections</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {detail.embedded}/{detail.chunks}
          </span>
          <span className={styles.statLabel}>Passages indexed</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{detail.ai_calls}</span>
          <span className={styles.statLabel}>AI calls about it</span>
        </div>
      </div>

      {detail.edges.length === 0 ? (
        <p className={styles.empty}>Nothing connects to this yet.</p>
      ) : (
        groupByKind(detail.edges).map(([key, rows]) => {
          const [kind, direction] = key.split(":");
          return (
            <div key={key} className={styles.group}>
              <h3 className={styles.groupTitle}>{heading(kind, direction)}</h3>
              {rows.map((edge) => (
                <button
                  key={edge.id}
                  className={styles.edgeRow}
                  onClick={() => onSelect(edge.other_id)}
                  type="button"
                >
                  <span className={styles.dot} style={{ background: nodeColor(edge.other_kind) }} />
                  <span className={styles.edgeLabel}>{edge.other_label}</span>
                  {isProposal(edge.source) && <span className={styles.proposed}>suggested</span>}
                </button>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
