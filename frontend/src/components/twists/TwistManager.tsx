import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Eye,
  RotateCcw,
  GitBranch,
  User,
  BookOpen,
  Compass,
  Brain,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import type { Twist, TwistType, TwistStatus, TwistClue, StructureNode } from "../../types";
import TwistClueEditor from "./TwistClueEditor";
import TwistAnalysisPanel from "./TwistAnalysisPanel";
import TwistImpactPanel from "./TwistImpactPanel";
import ReaderKnowledgeTimeline from "./ReaderKnowledgeTimeline";
import { SectionCard } from "../common";
import AIFeatureInfoTrigger from "../ai/AIFeatureInfoTrigger";
import styles from "./TwistManager.module.css";

type Tab = "twists" | "reader-knowledge" | "dramatic-irony";

interface Props {
  storyId: string;
}

const TYPE_OPTIONS: { value: TwistType; label: string; icon: React.ReactNode; tip: string }[] = [
  { value: "reveal", label: "Reveal", icon: <Eye size={11} />, tip: "Hidden information is exposed" },
  { value: "reversal", label: "Reversal", icon: <RotateCcw size={11} />, tip: "Expectations are subverted" },
  { value: "identity", label: "Identity", icon: <User size={11} />, tip: "Who someone really is" },
  {
    value: "unreliable_narrator",
    label: "Unreliable Narrator",
    icon: <BookOpen size={11} />,
    tip: "The narrator has been deceiving the reader",
  },
  {
    value: "red_herring",
    label: "Red Herring",
    icon: <GitBranch size={11} />,
    tip: "A deliberate false lead",
  },
];

const STATUS_OPTIONS: { value: TwistStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "seeding", label: "Seeding" },
  { value: "revealed", label: "Revealed" },
];

interface EditFields {
  name: string;
  the_truth: string;
  the_misdirection: string;
  twist_type: TwistType;
  status: TwistStatus;
  revealed_at_node_id: string | null;
  clues: TwistClue[];
}

function defaultEdit(t?: Twist): EditFields {
  return {
    name: t?.name ?? "",
    the_truth: t?.the_truth ?? "",
    the_misdirection: t?.the_misdirection ?? "",
    twist_type: t?.twist_type ?? "reveal",
    status: t?.status ?? "planned",
    revealed_at_node_id: t?.revealed_at_node_id ?? null,
    clues: t?.clues ?? [],
  };
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

function TypeIcon({ type }: { type: TwistType }) {
  const opt = TYPE_OPTIONS.find((o) => o.value === type);
  return (
    <span className={styles.typeIcon} title={opt?.tip}>
      {opt?.icon}
    </span>
  );
}

function StatusBadge({ status }: { status: TwistStatus }) {
  return (
    <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>
      {STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status}
    </span>
  );
}

export default function TwistManager({ storyId }: Props) {
  const [tab, setTab] = useState<Tab>("twists");
  const [twists, setTwists] = useState<Twist[]>([]);
  const [nodes, setNodes] = useState<StructureNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<TwistType>("reveal");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<EditFields>(defaultEdit());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [analyzeId, setAnalyzeId] = useState<string | null>(null);
  const [impactId, setImpactId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listTwists(storyId), api.getStructure(storyId)])
      .then(([t, s]) => {
        setTwists(t);
        setNodes(flattenNodes(s));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storyId]);

  useReloadOnUndo(["twist"], () => api.listTwists(storyId).then(setTwists));

  async function handleCreate() {
    if (!newName.trim()) return;
    const twist = await api.createTwist(storyId, { name: newName.trim(), twist_type: newType });
    setTwists((prev) => [...prev, twist]);
    setNewName("");
    setNewType("reveal");
    setCreating(false);
    // Auto-expand and enter edit mode for the new twist
    setExpandedId(twist.id);
    setEditingId(twist.id);
    setEditFields(defaultEdit(twist));
  }

  function startEdit(t: Twist) {
    setEditingId(t.id);
    setExpandedId(t.id);
    setEditFields(defaultEdit(t));
  }

  async function saveEdit(id: string) {
    const updated = await api.updateTwist(id, editFields);
    setTwists((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setEditingId(null);
  }

  async function doDelete(id: string) {
    setPendingDeleteId(null);
    await api.deleteTwist(id);
    setTwists((prev) => prev.filter((t) => t.id !== id));
    if (expandedId === id) setExpandedId(null);
    if (editingId === id) setEditingId(null);
    if (analyzeId === id) setAnalyzeId(null);
    if (impactId === id) setImpactId(null);
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
    if (editingId !== id) setEditingId(null);
  }

  if (loading) return <p className={styles.loading}>Loading…</p>;

  return (
    <div className={styles.manager}>
      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${tab === "twists" ? styles.tabBtnActive : ""}`}
          onClick={() => setTab("twists")}
        >
          <Eye size={13} />
          Twists
        </button>
        <button
          className={`${styles.tabBtn} ${tab === "reader-knowledge" ? styles.tabBtnActiveAi : ""}`}
          onClick={() => setTab("reader-knowledge")}
        >
          <Brain size={13} />
          Reader Knowledge
        </button>
        <button
          className={`${styles.tabBtn} ${tab === "dramatic-irony" ? styles.tabBtnActiveAi : ""}`}
          onClick={() => setTab("dramatic-irony")}
        >
          <AlertTriangle size={13} />
          Dramatic Irony
        </button>
      </div>

      {/* Reader Knowledge / Dramatic Irony tabs */}
      {tab === "reader-knowledge" && <ReaderKnowledgeTimeline storyId={storyId} />}
      {tab === "dramatic-irony" && <ReaderKnowledgeTimeline storyId={storyId} ironyOnly />}

      {/* Twists tab */}
      {tab === "twists" && (
        <div className={styles.inner}>
          <div className={styles.header}>
            <h2 className={styles.title}>Twists & Misdirection</h2>
            <AIFeatureInfoTrigger pageId="twists" size="sm" />
            <button onClick={() => setCreating(true)} className={styles.addBtn}>
              <Plus size={13} />
              New twist
            </button>
          </div>

          {creating && (
            <div className={styles.createForm}>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Twist name…"
                className={styles.nameInput}
              />
              <div className={styles.typeRow}>
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`${styles.typeBtn} ${newType === opt.value ? styles.typeBtnActive : ""}`}
                    onClick={() => setNewType(opt.value)}
                    title={opt.tip}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
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

          <div className={styles.twistList}>
            {twists.length === 0 && !creating && (
              <p className={styles.empty}>
                No twists yet. Track reveals, reversals, and misdirections to keep your secrets airtight.
              </p>
            )}

            {twists.map((t) => {
              const isExpanded = expandedId === t.id;
              const isEditing = editingId === t.id;
              const isAnalyzing = analyzeId === t.id;
              const isImpact = impactId === t.id;

              return (
                <div key={t.id} className={styles.twistCard}>
                  {/* Card header — always visible */}
                  <div
                    className={styles.cardHeader}
                    onClick={() => !isEditing && toggleExpand(t.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && !isEditing && toggleExpand(t.id)}
                  >
                    <div className={styles.cardHeaderLeft}>
                      <TypeIcon type={t.twist_type} />
                      <span className={styles.cardName}>{t.name}</span>
                      {t.clues.length > 0 && (
                        <span
                          className={styles.clueCount}
                          title={`${t.clues.length} clue${t.clues.length !== 1 ? "s" : ""}`}
                        >
                          {t.clues.length}
                        </span>
                      )}
                    </div>
                    <div className={styles.cardHeaderRight}>
                      <StatusBadge status={t.status} />
                      <button
                        className={`${styles.iconBtn} ${isAnalyzing ? styles.iconBtnActive : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAnalyzeId(isAnalyzing ? null : t.id);
                          if (!isAnalyzing) setImpactId(null);
                        }}
                        title="Analyze twist quality"
                        type="button"
                      >
                        <Compass size={13} />
                      </button>
                      <button
                        className={`${styles.iconBtn} ${isImpact ? styles.iconBtnActive : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setImpactId(isImpact ? null : t.id);
                          if (!isImpact) setAnalyzeId(null);
                        }}
                        title="Analyze downstream impact"
                        type="button"
                      >
                        <AlertTriangle size={13} />
                      </button>
                      <button
                        className={styles.iconBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(t);
                        }}
                        title="Edit"
                        type="button"
                      >
                        <Pencil size={13} />
                      </button>
                      {pendingDeleteId === t.id ? (
                        <div className={styles.deleteConfirm} onClick={(e) => e.stopPropagation()}>
                          <button
                            className={styles.deleteConfirmYes}
                            onClick={() => doDelete(t.id)}
                            type="button"
                          >
                            Delete
                          </button>
                          <button
                            className={styles.deleteConfirmNo}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDeleteId(null);
                            }}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDeleteId(t.id);
                          }}
                          title="Delete"
                          type="button"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      <span className={styles.chevron}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div className={styles.cardBody}>
                      {isEditing ? (
                        <div className={styles.editForm}>
                          {/* Type & Status */}
                          <SectionCard title="Type & Status" collapsible={false}>
                            <input
                              className={styles.nameInput}
                              value={editFields.name}
                              onChange={(e) => setEditFields((f) => ({ ...f, name: e.target.value }))}
                              placeholder="Twist name"
                            />
                            <div className={styles.typeRow}>
                              {TYPE_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  className={`${styles.typeBtn} ${editFields.twist_type === opt.value ? styles.typeBtnActive : ""}`}
                                  onClick={() => setEditFields((f) => ({ ...f, twist_type: opt.value }))}
                                  title={opt.tip}
                                >
                                  {opt.icon}
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                            <div className={styles.statusRow}>
                              {STATUS_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  className={`${styles.statusBtn} ${styles[`statusBtn_${opt.value}`]} ${editFields.status === opt.value ? styles.statusBtnActive : ""}`}
                                  onClick={() => setEditFields((f) => ({ ...f, status: opt.value }))}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </SectionCard>

                          {/* The Story */}
                          <SectionCard title="The Story">
                            <div className={styles.fieldGroup}>
                              <label className={styles.fieldLabel}>
                                <span className={styles.labelTruth}>The Truth</span>
                                <span className={styles.labelHint}>What's actually happening</span>
                              </label>
                              <textarea
                                className={styles.textarea}
                                value={editFields.the_truth}
                                onChange={(e) => setEditFields((f) => ({ ...f, the_truth: e.target.value }))}
                                placeholder="What is really going on?"
                                rows={3}
                              />
                            </div>
                            <div className={styles.fieldGroup}>
                              <label className={styles.fieldLabel}>
                                <span className={styles.labelMisdirect}>The Misdirection</span>
                                <span className={styles.labelHint}>What readers are led to believe</span>
                              </label>
                              <textarea
                                className={styles.textarea}
                                value={editFields.the_misdirection}
                                onChange={(e) =>
                                  setEditFields((f) => ({ ...f, the_misdirection: e.target.value }))
                                }
                                placeholder="What do you want readers to think?"
                                rows={3}
                              />
                            </div>
                            {nodes.length > 0 && (
                              <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>
                                  <span>Revealed in</span>
                                  <span className={styles.labelHint}>Scene where the truth is exposed</span>
                                </label>
                                <select
                                  className={styles.select}
                                  value={editFields.revealed_at_node_id ?? ""}
                                  onChange={(e) =>
                                    setEditFields((f) => ({
                                      ...f,
                                      revealed_at_node_id: e.target.value || null,
                                    }))
                                  }
                                >
                                  <option value="">— not yet assigned —</option>
                                  {nodes.map((n) => (
                                    <option key={n.id} value={n.id}>
                                      {"  ".repeat(n.level)}
                                      {n.title || `Untitled ${n.level_type}`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </SectionCard>

                          {/* Clues */}
                          <SectionCard title="Clues" variant="ai">
                            <TwistClueEditor
                              clues={editFields.clues}
                              nodes={nodes}
                              onChange={(clues) => setEditFields((f) => ({ ...f, clues }))}
                            />
                          </SectionCard>

                          <div className={styles.editActions}>
                            <button onClick={() => setEditingId(null)} className={styles.cancelBtn}>
                              Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(t.id)}
                              disabled={!editFields.name.trim()}
                              className={styles.saveBtn}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Read-only expanded view */
                        <div className={styles.readView}>
                          {t.the_truth && (
                            <div className={styles.readSection}>
                              <span className={styles.readLabelTruth}>Truth</span>
                              <p className={styles.readText}>{t.the_truth}</p>
                            </div>
                          )}
                          {t.the_misdirection && (
                            <div className={styles.readSection}>
                              <span className={styles.readLabelMisdirect}>Misdirection</span>
                              <p className={styles.readText}>{t.the_misdirection}</p>
                            </div>
                          )}
                          {t.revealed_at_node_id && (
                            <div className={styles.readSection}>
                              <span className={styles.readLabel}>Reveal</span>
                              <p className={styles.readText}>
                                {nodes.find((n) => n.id === t.revealed_at_node_id)?.title ?? "Scene linked"}
                              </p>
                            </div>
                          )}
                          {t.clues.length > 0 && (
                            <div className={styles.readClues}>
                              {t.clues.map((c) => (
                                <div key={c.id} className={styles.readClue}>
                                  <span
                                    className={`${styles.readClueDir} ${c.points_to === "truth" ? styles.readClueTruth : styles.readClueMisdirect}`}
                                  >
                                    → {c.points_to}
                                  </span>
                                  <span className={styles.readClueText}>{c.text}</span>
                                  <span className={styles.readClueSubtlety}>{c.subtlety}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {!t.the_truth && !t.the_misdirection && t.clues.length === 0 && (
                            <p className={styles.empty}>
                              Click edit to fill in the truth, misdirection, and clues.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Analysis panel */}
                  {isAnalyzing && (
                    <div className={styles.analysisWrap}>
                      <TwistAnalysisPanel twistId={t.id} />
                    </div>
                  )}

                  {/* Impact panel */}
                  {isImpact && (
                    <div className={styles.analysisWrap}>
                      <TwistImpactPanel twistId={t.id} twistName={t.name} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
