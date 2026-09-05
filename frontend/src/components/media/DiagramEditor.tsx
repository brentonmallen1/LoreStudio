import { useState, useCallback, useRef, useEffect } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Save, Trash2, Type, Circle, Square, Download, Palette, LayoutGrid } from "lucide-react";
import { api } from "../../api/client";
import type { Diagram } from "../../types";
import { exportDiagramPng, exportDiagramSvg } from "../../lib/diagramExport";
import DiagramTemplateSelector from "./DiagramTemplateSelector";
import type { DiagramTemplate } from "../../lib/diagramTemplates";
import styles from "./DiagramEditor.module.css";

// ---- Custom Node Types ----

function MindmapNode({ data, selected }: NodeProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label as string);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commitLabel() {
    if (data.onLabelChange)
      (data.onLabelChange as (id: string, label: string) => void)(data.id as string, label);
    setEditing(false);
  }

  return (
    <div
      className={`${styles.mindNode} ${selected ? styles.mindNodeSelected : ""}`}
      style={{ background: (data.color as string) || undefined }}
      onDoubleClick={() => setEditing(true)}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} />
      {editing ? (
        <input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitLabel();
            if (e.key === "Escape") {
              setLabel(data.label as string);
              setEditing(false);
            }
          }}
          className={styles.nodeInput}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className={styles.nodeLabel}>{data.label as string}</span>
      )}
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  );
}

function CentralNode({ data, selected }: NodeProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label as string);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commitLabel() {
    if (data.onLabelChange)
      (data.onLabelChange as (id: string, label: string) => void)(data.id as string, label);
    setEditing(false);
  }

  return (
    <div
      className={`${styles.centralNode} ${selected ? styles.centralNodeSelected : ""}`}
      onDoubleClick={() => setEditing(true)}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <Handle type="target" position={Position.Top} className={styles.handle} />
      {editing ? (
        <input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitLabel();
            if (e.key === "Escape") {
              setLabel(data.label as string);
              setEditing(false);
            }
          }}
          className={styles.nodeInput}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className={styles.centralLabel}>{data.label as string}</span>
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
  mindmap: MindmapNode,
  central: CentralNode,
};

// ---- Node category colors ----

const NODE_CATEGORIES = [
  { id: "none", label: "Default", color: "" },
  { id: "character", label: "Character", color: "#c26a3a" }, // --color-accent warm orange
  { id: "setting", label: "Setting", color: "#4a7fa3" }, // blue
  { id: "event", label: "Event", color: "#6a7a3a" }, // olive/green
  { id: "clue", label: "Clue", color: "#8b6aa8" }, // --color-ai purple
  { id: "twist", label: "Twist", color: "#a84a4a" }, // red
  { id: "note", label: "Note", color: "#a88a2a" }, // amber
] as const;

// ---- Helpers ----

function makeNodeId() {
  return `n${Date.now()}`;
}

function defaultNodesForType(type: string): RFNode[] {
  if (type === "mindmap") {
    return [
      { id: "central", type: "central", position: { x: 300, y: 200 }, data: { label: "Central Idea" } },
    ];
  }
  return [{ id: "start", type: "mindmap", position: { x: 100, y: 200 }, data: { label: "Start" } }];
}

// ---- Main Component ----

interface Props {
  diagram: Diagram;
  onSave?: (d: Diagram) => void;
  onClose?: () => void;
}

export default function DiagramEditor({ diagram, onSave, onClose }: Props) {
  const initialNodes: RFNode[] = diagram.nodes.length
    ? diagram.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: { ...(n.data as RFNodeData) },
      }))
    : defaultNodesForType(diagram.diagram_type);

  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>(diagram.edges as RFEdge[]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [title, setTitle] = useState(diagram.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(() => diagram.nodes.length === 0);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Inject label-change callback into node data
  const nodesWithCb: RFNode[] = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      onLabelChange: (id: string, label: string) => {
        setNodes((ns) =>
          ns.map((node) => (node.id === id ? { ...node, data: { ...node.data, label } } : node)),
        );
        setDirty(true);
      },
    },
  }));

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: diagram.diagram_type === "flowchart" }, eds));
      setDirty(true);
    },
    [setEdges, diagram.diagram_type],
  );

  function addNode(type: "mindmap" | "central" = "mindmap") {
    const id = makeNodeId();
    const newNode: RFNode = {
      id,
      type,
      position: { x: 150 + Math.random() * 300, y: 100 + Math.random() * 200 },
      data: { label: "New idea" },
    };
    setNodes((ns) => [...ns, newNode]);
    setDirty(true);
  }

  function deleteSelected() {
    setNodes((ns) => ns.filter((n) => !n.selected));
    setEdges((es) => es.filter((e) => !e.selected));
    setDirty(true);
  }

  function applyTemplate(template: DiagramTemplate) {
    const newNodes: RFNode[] = template.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { ...n.data } as RFNodeData,
    }));
    setNodes(newNodes);
    setEdges(template.edges as RFEdge[]);
    setTemplateOpen(false);
    setDirty(true);
  }

  function applyColor(color: string) {
    setNodes((ns) =>
      ns.map((n) => (n.selected ? { ...n, data: { ...n.data, color: color || undefined } } : n)),
    );
    setColorPickerOpen(false);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      // Strip callback functions before persisting; cast to match API schema
      const persistNodes = nodes.map(({ data: { onLabelChange: _cb, ...data }, ...rest }) => ({
        ...rest,
        data,
      }));
      const updated = await api.updateDiagram(diagram.id, {
        title,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodes: persistNodes as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        edges: edges as any,
      });
      setDirty(false);
      onSave?.(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        {editingTitle ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              setDirty(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") setEditingTitle(false);
            }}
            className={styles.titleInput}
          />
        ) : (
          <button className={styles.titleBtn} onClick={() => setEditingTitle(true)} title="Edit title">
            <Type size={12} />
            <span>{title}</span>
          </button>
        )}

        <div className={styles.toolbarActions}>
          <button
            onClick={() => setTemplateOpen(true)}
            className={styles.toolBtn}
            title="Start from template"
          >
            <LayoutGrid size={13} />
          </button>
          <button onClick={() => addNode("mindmap")} className={styles.toolBtn} title="Add node">
            <Circle size={13} /> <Plus size={11} />
          </button>
          {diagram.diagram_type === "flowchart" && (
            <button onClick={() => addNode("central")} className={styles.toolBtn} title="Add box node">
              <Square size={13} /> <Plus size={11} />
            </button>
          )}
          <div className={styles.exportWrap}>
            <button
              className={styles.toolBtn}
              title="Color selected nodes"
              onClick={() => setColorPickerOpen((v) => !v)}
            >
              <Palette size={13} />
            </button>
            {colorPickerOpen && (
              <div className={styles.colorMenu}>
                {NODE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => applyColor(cat.color)}
                    className={styles.colorOption}
                    title={cat.label}
                  >
                    <span
                      className={styles.colorSwatch}
                      style={{
                        background: cat.color || "var(--color-surface-raised)",
                        border: cat.color ? "none" : "1px solid var(--color-border)",
                      }}
                    />
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={deleteSelected}
            className={`${styles.toolBtn} ${styles.toolBtnDanger}`}
            title="Delete selected"
          >
            <Trash2 size={13} />
          </button>
          <button
            onClick={save}
            className={`${styles.toolBtn} ${styles.toolBtnSave}`}
            disabled={saving || !dirty}
            title="Save"
          >
            <Save size={13} />
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
          <div className={styles.exportWrap}>
            <button
              className={styles.toolBtn}
              title="Export diagram"
              onClick={() => setExportOpen((v) => !v)}
            >
              <Download size={13} />
            </button>
            {exportOpen && (
              <div className={styles.exportMenu}>
                <button
                  onClick={() => {
                    if (canvasRef.current) exportDiagramPng(canvasRef.current, title || "diagram");
                    setExportOpen(false);
                  }}
                >
                  Export PNG
                </button>
                <button
                  onClick={() => {
                    if (canvasRef.current) exportDiagramSvg(canvasRef.current, title || "diagram");
                    setExportOpen(false);
                  }}
                >
                  Export SVG
                </button>
              </div>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} className={styles.toolBtn} title="Close">
              ✕
            </button>
          )}
        </div>
      </div>

      <div className={styles.canvas} ref={canvasRef}>
        <ReactFlow
          nodes={nodesWithCb}
          edges={edges}
          onNodesChange={(changes) => {
            onNodesChange(changes);
            setDirty(true);
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
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--color-border)" />
        </ReactFlow>
      </div>

      <div className={styles.hint}>
        Double-click a node to edit its label · Drag from a handle to connect · Delete key removes selected
      </div>

      {templateOpen && (
        <DiagramTemplateSelector onSelect={applyTemplate} onClose={() => setTemplateOpen(false)} />
      )}
    </div>
  );
}
