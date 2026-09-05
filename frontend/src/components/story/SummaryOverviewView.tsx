import React, { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Compass, Square } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { StructureNode } from "../../types";
import { formatRelative, formatDate } from "../../lib/utils";
import styles from "./SummaryOverviewView.module.css";

function flattenNodes(nodes: StructureNode[]): StructureNode[] {
  const result: StructureNode[] = [];
  function walk(n: StructureNode) {
    result.push(n);
    if (n.children) n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

export default function SummaryOverviewView() {
  const { storyId } = useParams<{ storyId: string }>();
  const { structure, setStructure } = useStoryStore();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const [localUpdates, setLocalUpdates] = useState<
    Record<string, { summary: string; stale: boolean; updatedAt: string | null }>
  >({});
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResult, setBatchResult] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const allNodes = flattenNodes(structure);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(new Set(allNodes.map((n) => n.id)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  async function generate(node: StructureNode) {
    if (generatingId) return;
    setGeneratingId(node.id);
    setStreamText("");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await api.summarizeNode(node.id, controller.signal);
      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setStreamText(full);
      }

      if (full && !full.startsWith("No content to summarize")) {
        setLocalUpdates((prev) => ({
          ...prev,
          [node.id]: { summary: full, stale: false, updatedAt: new Date().toISOString() },
        }));
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    } finally {
      setGeneratingId(null);
      setStreamText("");
      abortRef.current = null;
    }
  }

  function cancelGeneration() {
    abortRef.current?.abort();
  }

  async function generateAllMissing() {
    if (!storyId) return;
    setBatchRunning(true);
    setBatchResult(null);
    try {
      const result = await api.summarizeScenesBatch(storyId);
      setBatchResult(`Generated ${result.summarized_count} of ${result.total_scenes} scenes.`);
      const updated = await api.getStructure(storyId);
      setStructure(updated);
    } catch {
      setBatchResult("Batch generation failed.");
    } finally {
      setBatchRunning(false);
    }
  }

  function nodeHasContent(node: StructureNode): boolean {
    if (node.content?.trim()) return true;
    if (node.children?.length) return true;
    return false;
  }

  function renderNode(node: StructureNode, depth: number): React.ReactElement {
    const hasChildren = (node.children?.length ?? 0) > 0;
    const isExpanded = expandedIds.has(node.id);
    const isGenerating = generatingId === node.id;

    const update = localUpdates[node.id];
    const summary = update?.summary ?? node.content_summary ?? "";
    const isStale = update ? update.stale : node.summary_stale;
    const hasSummary = summary.length > 0;
    const canGenerate = nodeHasContent(node);

    return (
      <div key={node.id} className={styles.nodeWrapper}>
        <button
          className={styles.nodeHeader}
          style={{ paddingLeft: `${depth * 20 + 12}px` }}
          onClick={() => toggleExpand(node.id)}
        >
          <span className={styles.chevron}>
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )
            ) : (
              <span className={styles.chevronPlaceholder} />
            )}
          </span>
          <span
            className={styles.levelBadge}
            style={{ backgroundColor: `var(--segment-${node.level_type}, var(--color-text-muted))` }}
          >
            {node.level_type}
          </span>
          <span className={styles.nodeTitle}>{node.title}</span>
          <span
            className={!hasSummary ? styles.dotNone : isStale ? styles.dotStale : styles.dotFresh}
            title={!hasSummary ? "No summary" : isStale ? "Stale" : "Fresh"}
          />
          {hasSummary &&
            (() => {
              const updatedAt = update?.updatedAt ?? node.summary_updated_at;
              return updatedAt ? (
                <span className={styles.timestamp} title={formatDate(updatedAt)}>
                  {formatRelative(updatedAt)}
                </span>
              ) : null;
            })()}
        </button>

        {isExpanded && (
          <>
            <div className={styles.nodeContent} style={{ paddingLeft: `${depth * 20 + 40}px` }}>
              {isGenerating ? (
                <p className={styles.streamText}>{streamText || "Generating…"}</p>
              ) : hasSummary ? (
                <p className={styles.summaryText}>{summary}</p>
              ) : (
                <p className={styles.noSummary}>
                  {canGenerate ? "No summary generated yet." : "No content to summarize."}
                </p>
              )}
              <div className={styles.nodeActions}>
                {isGenerating ? (
                  <button className={styles.cancelBtn} onClick={cancelGeneration}>
                    <Square size={10} />
                    Cancel
                  </button>
                ) : (
                  <button
                    className={styles.generateBtn}
                    onClick={() => generate(node)}
                    disabled={!!generatingId || !canGenerate}
                  >
                    <Compass size={10} />
                    {hasSummary ? "Regenerate" : "Generate"}
                  </button>
                )}
              </div>
            </div>
            {node.children?.map((child) => renderNode(child, depth + 1))}
          </>
        )}
      </div>
    );
  }

  if (allNodes.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>
          No story structure yet. Add sections in the tree view to get started.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h2 className={styles.heading}>Summary Overview</h2>
        </div>
        <div className={styles.toolbarRight}>
          <button className={styles.toolbarBtn} onClick={expandAll}>
            Expand All
          </button>
          <button className={styles.toolbarBtn} onClick={collapseAll}>
            Collapse All
          </button>
          <button
            className={`${styles.toolbarBtn} ${styles.toolbarBtnAi}`}
            onClick={generateAllMissing}
            disabled={batchRunning}
          >
            <Compass size={11} />
            {batchRunning ? "Generating…" : "Generate All Missing"}
          </button>
        </div>
      </div>

      {batchResult && <div className={styles.batchNotice}>{batchResult}</div>}

      <div className={styles.tree}>{structure.map((node) => renderNode(node, 0))}</div>
    </div>
  );
}
