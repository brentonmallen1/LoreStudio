import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as dagre from "dagre";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  type Connection,
  type NodeTypes,
  type Node,
  type Edge,
  Handle,
  Position,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, LayoutGrid, X, Save } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import type { StructureNode } from "../../types";
import styles from "./StoryboardView.module.css";

// ── Helpers ──────────────────────────────────────────────

function flattenNodes(nodes: StructureNode[]): StructureNode[] {
  const result: StructureNode[] = [];
  function walk(n: StructureNode) {
    result.push(n);
    n.children?.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

function getDescendantIds(nodeId: string, nodeMap: Map<string, StructureNode>): Set<string> {
  const result = new Set<string>();
  function collect(id: string) {
    result.add(id);
    nodeMap.get(id)?.children?.forEach((c) => collect(c.id));
  }
  collect(nodeId);
  return result;
}

function makeNoteId() {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Layout ────────────────────────────────────────────────

const NODE_W = 208;
const NODE_H = 96;

function applyDagreLayout(nodes: RFNode[], edges: RFEdge[]): RFNode[] {
  if (nodes.length === 0) return nodes;
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", ranksep: 60, nodesep: 24 });
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}

// ── Custom Node: Structure ────────────────────────────────

function StructureStoryboardNode({ data, selected }: NodeProps) {
  const levelType = data.levelType as string;
  const summary = data.summary as string | null;
  const summaryStale = data.summaryStale as boolean;
  const structureId = data.structureId as string;
  const onCenter = data.onCenter as ((id: string) => void) | undefined;
  const onOpen = data.onOpen as ((id: string) => void) | undefined;

  return (
    <div
      className={`${styles.structureNode} ${selected ? styles.structureNodeSelected : ""}`}
      style={{
        borderColor: `color-mix(in srgb, var(--segment-${levelType}, var(--color-border)) 55%, var(--color-border))`,
      }}
      onClick={() => onCenter?.(structureId)}
      onDoubleClick={() => onOpen?.(structureId)}
      title="Click to center · Double-click to open in editor"
    >
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <div className={styles.snHeader}>
        <span
          className={styles.snBadge}
          style={{ backgroundColor: `var(--segment-${levelType}, var(--color-text-muted))` }}
        >
          {levelType}
        </span>
        {summary && (
          <span
            className={summaryStale ? styles.dotStale : styles.dotFresh}
            title={summaryStale ? "Summary stale" : "Summary fresh"}
          />
        )}
      </div>
      <div className={styles.snTitle}>{data.label as string}</div>
      {summary ? (
        <div className={styles.snSummary}>{summary.length > 80 ? summary.slice(0, 77) + "…" : summary}</div>
      ) : (
        <div className={styles.snNoSummary}>No summary yet</div>
      )}
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}

// ── Custom Node: Note ─────────────────────────────────────

function NoteStoryboardNode({ data, id, selected }: NodeProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label as string);
  const inputRef = useRef<HTMLInputElement>(null);
  const color = data.color as string | undefined;
  const onLabelChange = data.onLabelChange as ((id: string, l: string) => void) | undefined;
  const onDelete = data.onDelete as ((id: string) => void) | undefined;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    onLabelChange?.(id, label);
    setEditing(false);
  }

  return (
    <div
      className={`${styles.noteNode} ${selected ? styles.noteNodeSelected : ""}`}
      style={{
        borderColor: color || undefined,
        backgroundColor: color ? `color-mix(in srgb, ${color} 12%, var(--color-surface))` : undefined,
      }}
      onDoubleClick={() => setEditing(true)}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <Handle type="target" position={Position.Top} className={styles.handle} />
      {editing ? (
        <input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setLabel(data.label as string);
              setEditing(false);
            }
          }}
          className={`${styles.noteInput} nodrag`}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className={styles.noteLabel}>{data.label as string}</span>
      )}
      {/* Delete button — inside bounds, visible on selection */}
      {selected && (
        <button
          className={`${styles.noteDeleteBtn} nodrag nopan`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(id);
          }}
          title="Delete note"
        >
          <X size={10} />
        </button>
      )}
      <Handle type="source" position={Position.Right} className={styles.handle} />
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  );
}

type RFNodeData = Record<string, unknown> & { label: string };
type RFNode = Node<RFNodeData>;
type RFEdge = Edge;

const NODE_TYPES: NodeTypes = {
  structureNode: StructureStoryboardNode,
  noteNode: NoteStoryboardNode,
};

const LEGEND_LEVELS = ["act", "chapter", "scene", "section", "beat"];

// ── Main Component ────────────────────────────────────────

export default function StoryboardView() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { structure, setActiveNode } = useStoryStore();
  const { setViewMode } = useUIStore();

  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>([]);
  const [filterParentId, setFilterParentId] = useState<string | null>(null);
  const [storyboardDiagramId, setStoryboardDiagramId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // ReactFlow instance for fitView / setCenter
  const rfRef = useRef<ReactFlowInstance<RFNode, RFEdge> | null>(null);
  // Track init to avoid double-loading
  const initialized = useRef(false);
  // Track previous structure node IDs for sync
  const prevStructureIdsRef = useRef<Set<string> | null>(null);

  const allStructureNodes = flattenNodes(structure);
  const nodeMap = new Map(allStructureNodes.map((n) => [n.id, n]));
  const parentNodes = allStructureNodes.filter((n) => (n.children?.length ?? 0) > 0);

  // Build ReactFlow nodes/edges from story structure
  function buildFromStructure(str: StructureNode[]): { rfNodes: RFNode[]; rfEdges: RFEdge[] } {
    const rfNodes: RFNode[] = [];
    const rfEdges: RFEdge[] = [];
    function walk(n: StructureNode) {
      rfNodes.push({
        id: `structure-${n.id}`,
        type: "structureNode",
        position: { x: 0, y: 0 },
        deletable: false,
        data: {
          label: n.title,
          structureId: n.id,
          levelType: n.level_type,
          summary: n.content_summary ?? null,
          summaryStale: n.summary_stale,
        } as RFNodeData,
      });
      n.children?.forEach((child) => {
        rfEdges.push({
          id: `edge-${n.id}-${child.id}`,
          source: `structure-${n.id}`,
          target: `structure-${child.id}`,
          type: "smoothstep",
          style: { stroke: "var(--color-border)", strokeWidth: 1.5 },
        });
        walk(child);
      });
    }
    str.forEach(walk);
    return { rfNodes, rfEdges };
  }

  function centerOnNode(structureId: string) {
    const rfNode = rfRef.current?.getNode(`structure-${structureId}`);
    if (rfNode && rfRef.current) {
      rfRef.current.setCenter(rfNode.position.x + NODE_W / 2, rfNode.position.y + NODE_H / 2, {
        duration: 400,
      });
    }
  }

  function navigateToStructureNode(structureId: string) {
    const sNode = nodeMap.get(structureId);
    if (sNode) {
      setActiveNode(sNode);
      setViewMode("tree");
      navigate(`/stories/${storyId}/write`);
    }
  }

  // ── Initial load ──
  async function initialize() {
    if (!storyId || structure.length === 0) return;
    const { rfNodes, rfEdges } = buildFromStructure(structure);
    const laidOut = applyDagreLayout(rfNodes, rfEdges);

    let noteNodes: RFNode[] = [];
    let noteEdges: RFEdge[] = [];
    let savedId: string | null = null;
    try {
      const diagrams = await api.listDiagrams(storyId);
      const existing = diagrams.find((d) => (d.diagram_type as string) === "storyboard");
      if (existing) {
        const full = await api.getDiagram(existing.id);
        savedId = full.id;
        noteNodes = full.nodes.map((n) => ({
          id: n.id,
          type: "noteNode",
          position: n.position,
          data: { label: n.data.label, color: n.data.color } as RFNodeData,
        }));
        noteEdges = full.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type,
          animated: e.animated,
        }));
      }
    } catch {
      /* silently skip */
    }

    setStoryboardDiagramId(savedId);
    setNodes([...laidOut, ...noteNodes]);
    setEdges([...rfEdges, ...noteEdges]);
    setIsReady(true);
  }

  useEffect(() => {
    if (!initialized.current && structure.length > 0) {
      initialized.current = true;
      initialize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure.length]);

  // ── Sync structure changes after initialization ──
  useEffect(() => {
    if (!isReady) return;

    const currIds = new Set(flattenNodes(structure).map((n) => n.id));

    // First run after ready — just record baseline, nodes already set by initialize()
    if (prevStructureIdsRef.current === null) {
      prevStructureIdsRef.current = currIds;
      return;
    }

    const prev = prevStructureIdsRef.current;
    const same = currIds.size === prev.size && [...currIds].every((id) => prev.has(id));
    prevStructureIdsRef.current = currIds;
    if (same) return;

    // Structure changed — sync nodes/edges, preserve existing positions
    const { rfNodes: newStructureNodes, rfEdges: newStructureEdges } = buildFromStructure(structure);
    const laidOut = applyDagreLayout(newStructureNodes, newStructureEdges);

    setNodes((currentNodes) => {
      const existingPositions = new Map(
        currentNodes.filter((n) => n.type === "structureNode").map((n) => [n.id, n.position]),
      );
      const updated = laidOut.map((n) => ({
        ...n,
        position: existingPositions.get(n.id) ?? n.position,
      }));
      return [...updated, ...currentNodes.filter((n) => n.type === "noteNode")];
    });

    setEdges((currentEdges) => {
      const userEdges = currentEdges.filter((e) => !e.id.startsWith("edge-"));
      return [...newStructureEdges, ...userEdges];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure, isReady]);

  // ── Inject callbacks ──
  const nodesWithCb: RFNode[] = nodes.map((n) => {
    if (n.type === "structureNode") {
      return {
        ...n,
        data: {
          ...n.data,
          onCenter: centerOnNode,
          onOpen: navigateToStructureNode,
        },
      };
    }
    if (n.type === "noteNode") {
      return {
        ...n,
        data: {
          ...n.data,
          onLabelChange: (id: string, label: string) => {
            setNodes((ns) =>
              ns.map((node) => (node.id === id ? { ...node, data: { ...node.data, label } } : node)),
            );
            setDirty(true);
          },
          onDelete: (id: string) => {
            setNodes((ns) => ns.filter((node) => node.id !== id));
            setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
            setDirty(true);
          },
        },
      };
    }
    return n;
  });

  // ── Filter ──
  const filteredIds = filterParentId ? getDescendantIds(filterParentId, nodeMap) : null;
  const visibleNodes = filteredIds
    ? nodesWithCb.filter((n) => {
        if (n.type === "noteNode") return true;
        const sid = n.data.structureId as string | undefined;
        return sid ? filteredIds.has(sid) : true;
      })
    : nodesWithCb;
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
      setDirty(true);
    },
    [setEdges],
  );

  function addNote() {
    setNodes((ns) => [
      ...ns,
      {
        id: makeNoteId(),
        type: "noteNode",
        position: { x: 60 + Math.random() * 200, y: 60 + Math.random() * 100 },
        data: { label: "Note" } as RFNodeData,
      },
    ]);
    setDirty(true);
  }

  function autoLayout() {
    const structureNodes = nodes.filter((n) => n.type === "structureNode");
    const structureEdges = edges.filter((e) => {
      const src = nodes.find((n) => n.id === e.source);
      const tgt = nodes.find((n) => n.id === e.target);
      return src?.type === "structureNode" && tgt?.type === "structureNode";
    });
    const laidOut = applyDagreLayout(structureNodes, structureEdges);
    setNodes((ns) => ns.map((n) => laidOut.find((l) => l.id === n.id) ?? n));
    // Fit view after React applies the position update
    requestAnimationFrame(() => {
      requestAnimationFrame(() => rfRef.current?.fitView({ padding: 0.12, duration: 400 }));
    });
  }

  async function save() {
    if (!storyId || !dirty) return;
    setSaving(true);
    try {
      const noteNodes = nodes.filter((n) => n.type === "noteNode");
      const userEdges = edges.filter((e) => {
        const src = nodes.find((n) => n.id === e.source);
        const tgt = nodes.find((n) => n.id === e.target);
        return src?.type === "noteNode" || tgt?.type === "noteNode";
      });
      const diagramNodes = noteNodes.map((n) => ({
        id: n.id,
        position: n.position,
        data: { label: n.data.label as string, color: n.data.color },
      }));
      const diagramEdges = userEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
        animated: e.animated ?? false,
      }));

      if (storyboardDiagramId) {
        await api.updateDiagram(storyboardDiagramId, {
          nodes: diagramNodes as unknown as import("../../types").DiagramNode[],
          edges: diagramEdges as unknown as import("../../types").DiagramEdge[],
        });
      } else {
        const created = await api.createDiagram(storyId, {
          title: "Storyboard",
          diagram_type: "storyboard",
        });
        await api.updateDiagram(created.id, {
          nodes: diagramNodes as unknown as import("../../types").DiagramNode[],
          edges: diagramEdges as unknown as import("../../types").DiagramEdge[],
        });
        setStoryboardDiagramId(created.id);
      }
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <select
            className={styles.filterSelect}
            value={filterParentId ?? ""}
            onChange={(e) => setFilterParentId(e.target.value || null)}
          >
            <option value="">All sections</option>
            {parentNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.level_type}: {n.title}
              </option>
            ))}
          </select>

          <div className={styles.legend}>
            {LEGEND_LEVELS.map((type) => (
              <span key={type} className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ borderColor: `var(--segment-${type})` }} />
                <span className={styles.legendLabel}>{type}</span>
              </span>
            ))}
            <span className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.legendSwatchNote}`} />
              <span className={styles.legendLabel}>note</span>
            </span>
          </div>
        </div>

        <div className={styles.toolbarRight}>
          <button className={styles.toolBtn} onClick={autoLayout} title="Auto-arrange layout">
            <LayoutGrid size={12} />
            Layout
          </button>
          <button className={styles.toolBtn} onClick={addNote}>
            <Plus size={12} />
            Note
          </button>
          <button
            className={`${styles.toolBtn} ${dirty ? styles.toolBtnSave : ""}`}
            onClick={save}
            disabled={saving || !dirty}
          >
            <Save size={12} />
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>

      <div className={styles.canvas}>
        <ReactFlow
          nodes={visibleNodes}
          edges={visibleEdges}
          onInit={(instance) => {
            rfRef.current = instance;
          }}
          onNodesChange={(changes) => {
            // Block keyboard-delete for structure nodes
            const safe = changes.filter((c) => {
              if (c.type === "remove") {
                const id = (c as { id: string }).id;
                return nodes.find((n) => n.id === id)?.type === "noteNode";
              }
              return true;
            });
            onNodesChange(safe);
            // Mark dirty only for note position/remove changes
            const noteChanges = safe.filter((c) => {
              if (c.type === "select" || c.type === "dimensions" || c.type === "add") return false;
              const id = (c as { id?: string }).id;
              if (!id) return false;
              return nodes.find((n) => n.id === id)?.type === "noteNode";
            });
            if (noteChanges.length > 0) setDirty(true);
          }}
          onEdgesChange={(changes) => {
            onEdgesChange(changes);
            setDirty(true);
          }}
          onConnect={onConnect}
          nodeTypes={NODE_TYPES}
          fitView
          deleteKeyCode="Delete"
        >
          <Controls />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-border)" />
        </ReactFlow>
      </div>

      <div className={styles.hint}>
        Click a story node to center it · Double-click to open in editor · Double-click a note to edit label
      </div>
    </div>
  );
}
