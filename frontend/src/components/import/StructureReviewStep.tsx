import { useState } from "react";
import { ChevronDown, ChevronRight, Compass, AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import { api } from "../../api/client";
import type { ImportPreviewTree, ImportPreviewNode, ImportUploadResponse } from "../../types";
import styles from "./StructureReviewStep.module.css";
import { MODIFIER } from "../../lib/keyboard/shortcuts";

interface Props {
  uploadResponse: ImportUploadResponse;
  preview: ImportPreviewTree;
  onPreviewUpdated: (updated: ImportPreviewTree) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function StructureReviewStep({
  uploadResponse,
  preview,
  onPreviewUpdated,
  onBack,
  onNext,
}: Props) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  async function handleAiAnalyze() {
    setAiLoading(true);
    setAiError(null);
    try {
      const resp = await api.importAiAnalyze(preview.session_id);
      onPreviewUpdated(resp.preview);
      setAiReasoning(resp.reasoning);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "AI analysis failed");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleRename(nodeId: string) {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      const updated = await api.importAdjust(preview.session_id, [
        {
          action: "rename",
          node_id: nodeId,
          new_title: editTitle.trim(),
        },
      ]);
      onPreviewUpdated(updated);
    } catch {
      // ignore — keep showing current title
    } finally {
      setEditingId(null);
    }
  }

  async function handleMergeUp(nodeId: string) {
    try {
      const updated = await api.importAdjust(preview.session_id, [
        {
          action: "merge_up",
          node_id: nodeId,
        },
      ]);
      onPreviewUpdated(updated);
    } catch {
      // ignore
    }
  }

  async function handleRelevel(nodeId: string, newLevel: number) {
    try {
      const updated = await api.importAdjust(preview.session_id, [
        {
          action: "relevel",
          node_id: nodeId,
          new_level: newLevel,
        },
      ]);
      onPreviewUpdated(updated);
    } catch {
      // ignore
    }
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const maxLevel = preview.template_levels.length - 1;
  const rootNodes = preview.nodes.filter((n) => n.parent_id === null);

  function renderNode(node: ImportPreviewNode, allNodes: ImportPreviewNode[], depth: number) {
    const children = allNodes.filter((n) => n.parent_id === node.id);
    const hasChildren = children.length > 0;
    const expanded = expandedIds.has(node.id);
    const isEditing = editingId === node.id;

    const confidenceClass =
      node.confidence >= 0.8 ? styles.high : node.confidence >= 0.5 ? styles.medium : styles.low;

    return (
      <div key={node.id} className={styles.nodeRow} style={{ paddingLeft: `${depth * 1.25}rem` }}>
        <div className={`${styles.nodeLine} ${node.needs_review ? styles.needsReview : ""}`}>
          {/* Expand toggle */}
          {hasChildren || node.content_preview ? (
            <button className={styles.expandBtn} onClick={() => toggleExpand(node.id)}>
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : (
            <span className={styles.leafDot} />
          )}

          {/* Level badge */}
          <span className={`${styles.levelBadge} ${styles[`level${node.level}`]}`}>{node.level_type}</span>

          {/* Title (editable) */}
          {isEditing ? (
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => handleRename(node.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename(node.id);
                if (e.key === "Escape") setEditingId(null);
              }}
              className={styles.titleInput}
            />
          ) : (
            <span
              className={styles.nodeTitle}
              onDoubleClick={() => {
                setEditingId(node.id);
                setEditTitle(node.title);
              }}
              title="Double-click to rename"
            >
              {node.title}
            </span>
          )}

          {/* Source / confidence indicators */}
          <span className={`${styles.sourceTag} ${node.source === "ai" ? styles.aiTag : ""}`}>
            {node.source === "ai" ? "AI" : node.source === "user" ? "edited" : ""}
          </span>
          {node.needs_review && (
            <span title="Needs review">
              <AlertTriangle size={11} className={styles.reviewIcon} />
            </span>
          )}
          <span
            className={`${styles.confidenceDot} ${confidenceClass}`}
            title={`Confidence: ${Math.round(node.confidence * 100)}%`}
          />

          {/* Word count */}
          <span className={styles.wordCount}>{node.word_count.toLocaleString()}w</span>

          {/* Actions */}
          <div className={styles.actions}>
            {node.level < maxLevel && (
              <button
                className={styles.actionBtn}
                onClick={() => handleRelevel(node.id, node.level + 1)}
                title="Demote (move deeper)"
              >
                ↓
              </button>
            )}
            {node.level > 0 && (
              <button
                className={styles.actionBtn}
                onClick={() => handleRelevel(node.id, node.level - 1)}
                title="Promote (move shallower)"
              >
                ↑
              </button>
            )}
            <button
              className={styles.actionBtn}
              onClick={() => handleMergeUp(node.id)}
              title="Merge into previous section"
            >
              {MODIFIER.alt}
            </button>
          </div>
        </div>

        {/* Content preview (expandable) */}
        {expanded && node.content_preview && (
          <div className={styles.contentPreview} style={{ marginLeft: `${(depth + 1) * 1.25}rem` }}>
            {node.content_preview}
            {node.word_count > 200 && <span className={styles.ellipsis}> …</span>}
          </div>
        )}

        {/* Children */}
        {hasChildren && expanded && children.map((child) => renderNode(child, allNodes, depth + 1))}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {/* Warnings */}
      {preview.warnings.length > 0 && (
        <div className={styles.warnings}>
          {preview.warnings.map((w, i) => (
            <p key={i} className={styles.warning}>
              <AlertTriangle size={12} />
              {w}
            </p>
          ))}
        </div>
      )}

      {/* AI suggestion bar */}
      <div className={styles.aiBar}>
        <div className={styles.aiBarLeft}>
          {aiReasoning && (
            <p className={styles.aiReasoning}>
              <Compass size={11} style={{ color: "var(--color-ai)" }} />
              {aiReasoning}
            </p>
          )}
          {aiError && <p className={styles.aiError}>{aiError}</p>}
        </div>
        {uploadResponse.ai_available && (uploadResponse.has_unstructured_blocks || true) && (
          <button
            onClick={handleAiAnalyze}
            disabled={aiLoading}
            className={styles.aiBtn}
            title="Ask AI to detect scene breaks (positions only; your text is never changed)"
          >
            <Compass size={12} />
            {aiLoading ? "Analyzing…" : "Auto-segment"}
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className={styles.stats}>
        <span>{preview.nodes.length} sections detected</span>
        <span>·</span>
        <span>{preview.total_word_count.toLocaleString()} words total</span>
        <span>·</span>
        <span>{preview.source_format.toUpperCase()}</span>
      </div>

      {/* Node tree */}
      <div className={styles.tree}>
        {preview.nodes.length === 0 ? (
          <p className={styles.empty}>No sections detected.</p>
        ) : (
          rootNodes.map((node) => renderNode(node, preview.nodes, 0))
        )}
      </div>

      <p className={styles.editHint}>
        Double-click any title to rename. Use ↑↓ to change level. {MODIFIER.alt} merges a section into the one
        above.
      </p>

      {/* Navigation */}
      <div className={styles.footer}>
        <button onClick={onBack} className={styles.backBtn}>
          <ArrowLeft size={13} />
          Back
        </button>
        <button onClick={onNext} className={styles.nextBtn} disabled={preview.nodes.length === 0}>
          Continue
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
