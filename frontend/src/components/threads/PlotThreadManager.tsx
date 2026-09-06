import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  List,
  Network,
  BookOpen,
  MapPin,
  HelpCircle,
  User,
  Zap,
  Compass,
} from "lucide-react";
import { api } from "../../api/client";
import type { PlotThread, MICEType, TryFailCycle, StructureNode } from "../../types";
import ThreadVisualization from "./ThreadVisualization";
import MICEGuide from "../help/MICEGuide";
import TryFailCycleEditor from "./TryFailCycleEditor";
import ThreadAnalysisPanel from "./ThreadAnalysisPanel";
import { SectionCard } from "../common";
import AIFeatureInfoTrigger from "../ai/AIFeatureInfoTrigger";
import styles from "./PlotThreadManager.module.css";
import AIOnly from "../ai/AIOnly";

interface Props {
  storyId: string;
}

const STATUS_OPTIONS = ["open", "developing", "resolved"] as const;
const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  developing: "Developing",
  resolved: "Resolved",
};

const PRESET_COLORS = [
  "#6b7280",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

const MICE_OPTIONS: { value: MICEType; label: string; icon: React.ReactNode; tooltip: string }[] = [
  {
    value: "milieu",
    label: "Milieu",
    icon: <MapPin size={12} />,
    tooltip: "A stranger enters a strange land — opens when entering, closes when leaving",
  },
  {
    value: "idea",
    label: "Idea",
    icon: <HelpCircle size={12} />,
    tooltip: "A question is raised — opens with the question, closes with the answer",
  },
  {
    value: "character",
    label: "Character",
    icon: <User size={12} />,
    tooltip: "Someone wants to change — opens with dissatisfaction, closes with transformation or acceptance",
  },
  {
    value: "event",
    label: "Event",
    icon: <Zap size={12} />,
    tooltip: "The world is out of balance — opens with disruption, closes with new equilibrium",
  },
];

interface EditFields {
  name: string;
  description: string;
  status: string;
  color: string;
  mice_type: MICEType | null;
  opens_at_node_id: string | null;
  closes_at_node_id: string | null;
  try_fail_cycles: TryFailCycle[];
}

function flattenNodes(nodes: StructureNode[]): StructureNode[] {
  const result: StructureNode[] = [];
  function walk(ns: StructureNode[]) {
    for (const n of [...ns].sort((a, b) => a.position - b.position)) {
      result.push(n);
      if (n.children?.length) walk(n.children);
    }
  }
  walk(nodes);
  return result;
}

export default function PlotThreadManager({ storyId }: Props) {
  const [view, setView] = useState<"list" | "viz">("list");
  const [threads, setThreads] = useState<PlotThread[]>([]);
  const [nodes, setNodes] = useState<StructureNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [showMICEGuide, setShowMICEGuide] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editFields, setEditFields] = useState<EditFields>({
    name: "",
    description: "",
    status: "open",
    color: PRESET_COLORS[0],
    mice_type: null,
    opens_at_node_id: null,
    closes_at_node_id: null,
    try_fail_cycles: [],
  });

  useEffect(() => {
    Promise.all([api.listThreads(storyId), api.getStructure(storyId)])
      .then(([t, s]) => {
        setThreads(t);
        setNodes(flattenNodes(s));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storyId]);

  async function handleCreate() {
    if (!newName.trim()) return;
    const thread = await api.createThread(storyId, { name: newName.trim(), color: newColor });
    setThreads((prev) => [...prev, thread]);
    setNewName("");
    setNewColor(PRESET_COLORS[0]);
    setCreating(false);
  }

  function startEdit(t: PlotThread) {
    setEditingId(t.id);
    setEditFields({
      name: t.name,
      description: t.description,
      status: t.status,
      color: t.color,
      mice_type: t.mice_type,
      opens_at_node_id: t.opens_at_node_id,
      closes_at_node_id: t.closes_at_node_id,
      try_fail_cycles: t.try_fail_cycles ?? [],
    });
  }

  async function saveEdit(id: string) {
    const updated = await api.updateThread(id, editFields);
    setThreads((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setEditingId(null);
  }

  async function doDelete(id: string) {
    setPendingDeleteId(null);
    await api.deleteThread(id);
    setThreads((prev) => prev.filter((t) => t.id !== id));
  }

  if (loading) return <p className={styles.loading}>Loading…</p>;

  const viewToggle = (
    <div className={styles.viewToggle}>
      <button
        className={`${styles.viewBtn} ${view === "list" ? styles.viewActive : ""}`}
        onClick={() => setView("list")}
        title="List view"
      >
        <List size={13} />
      </button>
      <button
        className={`${styles.viewBtn} ${view === "viz" ? styles.viewActive : ""}`}
        onClick={() => setView("viz")}
        title="Thread weave"
      >
        <Network size={13} />
      </button>
    </div>
  );

  if (view === "viz") {
    return (
      <div className={styles.vizWrap}>
        <div className={styles.vizHeader}>
          <h2 className={styles.title}>Plot Threads</h2>
          {viewToggle}
        </div>
        <ThreadVisualization storyId={storyId} />
      </div>
    );
  }

  return (
    <>
      {showMICEGuide && <MICEGuide onClose={() => setShowMICEGuide(false)} />}
      <div className={styles.manager}>
        <div className={styles.managerInner}>
          <div className={styles.header}>
            <h2 className={styles.title}>Plot Threads</h2>
            <div className={styles.headerRight}>
              {viewToggle}
              <AIFeatureInfoTrigger pageId="plot-threads" size="sm" />
              <button
                onClick={() => setShowMICEGuide(true)}
                className={styles.guideBtn}
                title="Learn about the MICE Quotient framework"
              >
                <BookOpen size={13} />
                MICE Guide
              </button>
              <button onClick={() => setCreating(true)} className={styles.addBtn}>
                <Plus size={13} />
                New thread
              </button>
            </div>
          </div>

          {creating && (
            <div className={styles.createForm}>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Thread name…"
                className={styles.nameInput}
              />
              <div className={styles.colorRow}>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`${styles.colorSwatch} ${newColor === c ? styles.colorSelected : ""}`}
                    style={{ background: c }}
                    onClick={() => setNewColor(c)}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
              <div className={styles.createActions}>
                <button onClick={() => setCreating(false)} className={styles.cancelBtn}>
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={!newName.trim()} className={styles.saveBtn}>
                  Create
                </button>
              </div>
            </div>
          )}

          <div className={styles.threadList}>
            {threads.length === 0 && !creating && (
              <p className={styles.empty}>
                No plot threads yet. Add one to start tracking narrative threads.
              </p>
            )}
            {threads.map((t) => (
              <div key={t.id} className={styles.threadCard}>
                {editingId === t.id ? (
                  <div className={styles.editForm}>
                    {/* Thread Details */}
                    <SectionCard title="Thread Details" collapsible={false}>
                      <input
                        value={editFields.name}
                        onChange={(e) => setEditFields((f) => ({ ...f, name: e.target.value }))}
                        className={styles.nameInput}
                        placeholder="Thread name"
                      />
                      <textarea
                        value={editFields.description}
                        onChange={(e) => setEditFields((f) => ({ ...f, description: e.target.value }))}
                        className={styles.descInput}
                        placeholder="Description (optional)"
                        rows={2}
                      />
                    </SectionCard>

                    {/* MICE Framework */}
                    <SectionCard title="MICE Framework" variant="ai">
                      <div className={styles.miceSection}>
                        <span className={styles.fieldLabel}>
                          MICE type
                          <button
                            className={styles.inlineGuideBtn}
                            onClick={() => setShowMICEGuide(true)}
                            title="What is MICE?"
                            type="button"
                          >
                            ?
                          </button>
                        </span>
                        <div className={styles.miceButtons}>
                          <button
                            className={`${styles.miceBtn} ${editFields.mice_type === null ? styles.miceBtnActive : ""} ${styles.miceBtnNone}`}
                            onClick={() => setEditFields((f) => ({ ...f, mice_type: null }))}
                            type="button"
                          >
                            None
                          </button>
                          {MICE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              className={`${styles.miceBtn} ${styles[`miceBtn_${opt.value}`]} ${editFields.mice_type === opt.value ? styles.miceBtnActive : ""}`}
                              onClick={() => setEditFields((f) => ({ ...f, mice_type: opt.value }))}
                              title={opt.tooltip}
                              type="button"
                            >
                              {opt.icon}
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {editFields.mice_type && nodes.length > 0 && (
                        <div className={styles.openCloseRow}>
                          <div className={styles.openCloseField}>
                            <label className={styles.fieldLabel}>Opens at</label>
                            <select
                              className={styles.statusSelect}
                              value={editFields.opens_at_node_id ?? ""}
                              onChange={(e) =>
                                setEditFields((f) => ({ ...f, opens_at_node_id: e.target.value || null }))
                              }
                            >
                              <option value="">— not set —</option>
                              {nodes.map((n) => (
                                <option key={n.id} value={n.id}>
                                  {"  ".repeat(n.level)}
                                  {n.title || `Untitled ${n.level_type}`}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className={styles.openCloseField}>
                            <label className={styles.fieldLabel}>Closes at</label>
                            <select
                              className={styles.statusSelect}
                              value={editFields.closes_at_node_id ?? ""}
                              onChange={(e) =>
                                setEditFields((f) => ({ ...f, closes_at_node_id: e.target.value || null }))
                              }
                            >
                              <option value="">— not set —</option>
                              {nodes.map((n) => (
                                <option key={n.id} value={n.id}>
                                  {"  ".repeat(n.level)}
                                  {n.title || `Untitled ${n.level_type}`}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </SectionCard>

                    {/* Try/Fail Cycles */}
                    <SectionCard title="Try/Fail Cycles">
                      <TryFailCycleEditor
                        cycles={editFields.try_fail_cycles}
                        nodes={nodes.filter((n) => !n.children?.length)}
                        onChange={(cycles) => setEditFields((f) => ({ ...f, try_fail_cycles: cycles }))}
                      />
                    </SectionCard>

                    {/* Status & Display */}
                    <SectionCard title="Status & Display" collapsible={false}>
                      <div className={styles.editRow}>
                        <select
                          value={editFields.status}
                          onChange={(e) => setEditFields((f) => ({ ...f, status: e.target.value }))}
                          className={styles.statusSelect}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                        <div className={styles.colorRow}>
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              className={`${styles.colorSwatch} ${editFields.color === c ? styles.colorSelected : ""}`}
                              style={{ background: c }}
                              onClick={() => setEditFields((f) => ({ ...f, color: c }))}
                              aria-label={`Color ${c}`}
                            />
                          ))}
                        </div>
                      </div>
                    </SectionCard>

                    <div className={styles.createActions}>
                      <button onClick={() => setEditingId(null)} className={styles.cancelBtn}>
                        <X size={12} /> Cancel
                      </button>
                      <button onClick={() => saveEdit(t.id)} className={styles.saveBtn}>
                        <Check size={12} /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.threadLeft}>
                      <span className={styles.colorDot} style={{ background: t.color }} />
                      <div className={styles.threadBody}>
                        <span className={styles.threadName}>{t.name}</span>
                        {t.description && <p className={styles.threadDesc}>{t.description}</p>}
                        <div className={styles.threadMeta}>
                          <span className={`${styles.statusBadge} ${styles[`status_${t.status}`]}`}>
                            {STATUS_LABELS[t.status]}
                          </span>
                          {t.mice_type && (
                            <span className={`${styles.miceBadge} ${styles[`miceBadge_${t.mice_type}`]}`}>
                              {MICE_OPTIONS.find((o) => o.value === t.mice_type)?.icon}
                              {t.mice_type.charAt(0).toUpperCase() + t.mice_type.slice(1)}
                            </span>
                          )}
                          <span className={styles.appearCount}>
                            {t.appearances.length} scene{t.appearances.length !== 1 ? "s" : ""}
                          </span>
                          {(t.try_fail_cycles?.length ?? 0) > 0 && (
                            <span className={styles.cycleCount}>{t.try_fail_cycles.length} try/fail</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={styles.threadActions}>
                      <AIOnly>
                        <button
                          onClick={() => setAnalyzingId(analyzingId === t.id ? null : t.id)}
                          className={`${styles.iconBtn} ${analyzingId === t.id ? styles.iconBtnActive : ""}`}
                          title="Analyze thread"
                          aria-label="Analyze thread"
                        >
                          <Compass size={12} />
                        </button>
                      </AIOnly>
                      <button onClick={() => startEdit(t)} className={styles.iconBtn} aria-label="Edit">
                        <Edit2 size={12} />
                      </button>
                      {pendingDeleteId === t.id ? (
                        <div className={styles.deleteConfirm}>
                          <button className={styles.deleteConfirmYes} onClick={() => doDelete(t.id)}>
                            Delete
                          </button>
                          <button className={styles.deleteConfirmNo} onClick={() => setPendingDeleteId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPendingDeleteId(t.id)}
                          className={`${styles.iconBtn} ${styles.danger}`}
                          aria-label="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </>
                )}
                {analyzingId === t.id && (
                  <div className={styles.analysisWrap}>
                    <ThreadAnalysisPanel threadId={t.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
