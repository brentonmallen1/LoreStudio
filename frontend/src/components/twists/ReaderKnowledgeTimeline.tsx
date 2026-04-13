import { useState, useEffect } from "react";
import { Compass, Plus, Trash2, Scan, X, ChevronDown, ChevronRight, Check } from "lucide-react";
import { api } from "../../api/client";
import type { ReaderKnowledgeEvent, KnowledgeType, StructureNode } from "../../types";
import styles from "./ReaderKnowledgeTimeline.module.css";

interface Props {
  storyId: string;
  /** If provided, only show events for dramatic irony (reader_knows but characters don't) */
  ironyOnly?: boolean;
}

const KNOWLEDGE_TYPE_META: Record<KnowledgeType, { label: string; color: string }> = {
  truth_revealed:       { label: "Truth revealed",      color: "truth" },
  misdirection_planted: { label: "Misdirection",        color: "misdirect" },
  clue_planted:         { label: "Clue planted",        color: "clue" },
  character_learns:     { label: "Character learns",    color: "char" },
  reader_only:          { label: "Reader only",         color: "reader" },
};

const KNOWLEDGE_TYPES: KnowledgeType[] = [
  "truth_revealed",
  "misdirection_planted",
  "clue_planted",
  "character_learns",
  "reader_only",
];

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

interface EventCardProps {
  event: ReaderKnowledgeEvent;
  onDelete: (id: string) => void;
}

function EventCard({ event, onDelete }: EventCardProps) {
  const [open, setOpen] = useState(false);
  const meta = KNOWLEDGE_TYPE_META[event.knowledge_type as KnowledgeType] ?? { label: event.knowledge_type, color: "clue" };

  return (
    <div className={`${styles.eventCard} ${styles[`type_${meta.color}`]}`}>
      <button className={styles.eventCardHeader} onClick={() => setOpen((o) => !o)}>
        <span className={`${styles.typeBadge} ${styles[`badge_${meta.color}`]}`}>{meta.label}</span>
        {!event.is_truth && <span className={styles.falseBadge}>Misdirection</span>}
        <span className={styles.eventSubject}>{event.subject}</span>
        {event.characters_who_know.length > 0 && (
          <span className={styles.charKnowCount} title={event.characters_who_know.join(", ")}>
            {event.characters_who_know.length} char
          </span>
        )}
        <span className={styles.cardChevron}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <button
          className={styles.deleteBtn}
          onClick={(e) => { e.stopPropagation(); onDelete(event.id); }}
          title="Delete"
        >
          <Trash2 size={11} />
        </button>
      </button>
      {open && (
        <div className={styles.eventCardBody}>
          {event.detail && <p className={styles.eventDetail}>{event.detail}</p>}
          <div className={styles.eventMeta}>
            <span className={`${styles.metaChip} ${event.reader_knows ? styles.chipReaderYes : styles.chipReaderNo}`}>
              {event.reader_knows ? "Reader knows" : "Reader doesn't know"}
            </span>
            {event.characters_who_know.length > 0 && (
              <span className={styles.metaChip}>
                Characters: {event.characters_who_know.join(", ")}
              </span>
            )}
            {event.twist_name && (
              <span className={styles.metaChip}>Twist: {event.twist_name}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReaderKnowledgeTimeline({ storyId, ironyOnly = false }: Props) {
  const [events, setEvents] = useState<ReaderKnowledgeEvent[]>([]);
  const [nodes, setNodes] = useState<StructureNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [addingToNode, setAddingToNode] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    subject: "",
    detail: "",
    knowledge_type: "truth_revealed" as KnowledgeType,
    reader_knows: true,
    is_truth: true,
    characters_who_know: "",
    node_id: null as string | null,
  });

  useEffect(() => {
    Promise.all([
      api.listReaderKnowledgeEvents(storyId),
      api.getStructure(storyId),
    ])
      .then(([evs, structure]) => {
        setEvents(evs);
        setNodes(flattenNodes(structure));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storyId]);

  // Filter for irony view: reader knows but no/few characters know
  const displayedEvents = ironyOnly
    ? events.filter((e) => e.reader_knows && e.characters_who_know.length === 0)
    : events;

  // Group events by node_id (null = unlinked)
  const byNode = new Map<string | null, ReaderKnowledgeEvent[]>();
  for (const e of displayedEvents) {
    const key = e.node_id ?? null;
    if (!byNode.has(key)) byNode.set(key, []);
    byNode.get(key)!.push(e);
  }

  // Build display order: scenes in story order, then unlinked
  const orderedNodeIds: Array<{ id: string | null; title: string }> = [];
  for (const node of nodes) {
    if (byNode.has(node.id)) {
      orderedNodeIds.push({ id: node.id, title: node.title || `Untitled ${node.level_type}` });
    }
  }
  if (byNode.has(null)) {
    orderedNodeIds.push({ id: null, title: "Not linked to a scene" });
  }

  async function handleScan() {
    setScanning(true);
    try {
      const newEvents = await api.scanReaderKnowledgeEvents(storyId);
      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        return [...prev, ...newEvents.filter((e) => !existingIds.has(e.id))];
      });
    } catch (e) {
      console.error("Scan failed", e);
    } finally {
      setScanning(false);
    }
  }

  async function handleDelete(id: string) {
    await api.deleteReaderKnowledgeEvent(id).catch(() => {});
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function openAddForm(nodeId: string | null) {
    setAddingToNode(nodeId ?? "__unlinked__");
    setAddForm({ subject: "", detail: "", knowledge_type: "truth_revealed", reader_knows: true, is_truth: true, characters_who_know: "", node_id: nodeId });
  }

  async function handleAdd() {
    if (!addForm.subject.trim()) return;
    const chars = addForm.characters_who_know
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const created = await api.createReaderKnowledgeEvent(storyId, {
      ...addForm,
      characters_who_know: chars,
    });
    setEvents((prev) => [...prev, created]);
    setAddingToNode(null);
  }

  if (loading) return <p className={styles.loading}>Loading…</p>;

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Compass size={15} className={styles.headerIcon} />
          <h3 className={styles.headerTitle}>
            {ironyOnly ? "Dramatic Irony" : "Reader Knowledge Timeline"}
          </h3>
          <span className={styles.eventCount}>{displayedEvents.length}</span>
        </div>
        <div className={styles.headerRight}>
          {!ironyOnly && (
            <button className={styles.scanBtn} onClick={handleScan} disabled={scanning}>
              <Scan size={12} className={scanning ? styles.scanSpin : undefined} />
              {scanning ? "Scanning…" : "Scan with AI"}
            </button>
          )}
          {!ironyOnly && (
            <button className={styles.addBtn} onClick={() => openAddForm(null)}>
              <Plus size={12} />
              Add event
            </button>
          )}
        </div>
      </div>

      {ironyOnly && (
        <p className={styles.ironyHint}>
          Showing moments where readers know something that the characters don't. This gap creates dramatic irony.
        </p>
      )}

      {/* Add form (floating at top for unlinked) */}
      {addingToNode === "__unlinked__" && (
        <AddForm
          form={addForm}
          nodes={nodes}
          onChange={(f) => setAddForm(f)}
          onSave={handleAdd}
          onCancel={() => setAddingToNode(null)}
        />
      )}

      {displayedEvents.length === 0 && (
        <div className={styles.empty}>
          <Compass size={18} className={styles.emptyIcon} />
          <p>
            {ironyOnly
              ? "No dramatic irony moments found. Add reader knowledge events where readers know more than the characters."
              : 'No knowledge events yet. Use "Scan with AI" to auto-detect from scene synopses, or add manually.'}
          </p>
        </div>
      )}

      {/* Timeline */}
      <div className={styles.timeline}>
        {orderedNodeIds.map(({ id: nodeId, title: nodeTitle }) => {
          const nodeEvents = byNode.get(nodeId) ?? [];
          const isAddingHere = addingToNode === nodeId;
          return (
            <div key={nodeId ?? "__unlinked__"} className={styles.timelineGroup}>
              <div className={styles.groupHeader}>
                <div className={styles.groupDot} />
                <span className={styles.groupTitle}>{nodeTitle}</span>
                {!ironyOnly && (
                  <button
                    className={styles.groupAddBtn}
                    onClick={() => openAddForm(nodeId)}
                    title="Add event here"
                  >
                    <Plus size={11} />
                  </button>
                )}
              </div>

              {isAddingHere && (
                <AddForm
                  form={addForm}
                  nodes={nodes}
                  onChange={(f) => setAddForm(f)}
                  onSave={handleAdd}
                  onCancel={() => setAddingToNode(null)}
                />
              )}

              <div className={styles.groupEvents}>
                {nodeEvents.map((ev) => (
                  <EventCard key={ev.id} event={ev} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface AddFormProps {
  form: {
    subject: string;
    detail: string;
    knowledge_type: KnowledgeType;
    reader_knows: boolean;
    is_truth: boolean;
    characters_who_know: string;
    node_id: string | null;
  };
  nodes: StructureNode[];
  onChange: (f: AddFormProps["form"]) => void;
  onSave: () => void;
  onCancel: () => void;
}

function AddForm({ form, nodes, onChange, onSave, onCancel }: AddFormProps) {
  function set(patch: Partial<AddFormProps["form"]>) {
    onChange({ ...form, ...patch });
  }

  return (
    <div className={styles.addForm}>
      <div className={styles.addFormRow}>
        <input
          autoFocus
          className={styles.addInput}
          value={form.subject}
          onChange={(e) => set({ subject: e.target.value })}
          placeholder='Subject (e.g. "Marcus killed Irene")'
        />
        <button className={styles.formCloseBtn} onClick={onCancel}><X size={13} /></button>
      </div>
      <textarea
        className={styles.addTextarea}
        value={form.detail}
        onChange={(e) => set({ detail: e.target.value })}
        placeholder="Detail (optional)"
        rows={2}
      />
      <div className={styles.addFormMeta}>
        <select
          className={styles.addSelect}
          value={form.knowledge_type}
          onChange={(e) => set({ knowledge_type: e.target.value as KnowledgeType })}
        >
          {KNOWLEDGE_TYPES.map((kt) => (
            <option key={kt} value={kt}>{KNOWLEDGE_TYPE_META[kt].label}</option>
          ))}
        </select>
        <select
          className={styles.addSelect}
          value={form.node_id ?? ""}
          onChange={(e) => set({ node_id: e.target.value || null })}
        >
          <option value="">— No scene —</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {"  ".repeat(n.level)}{n.title || `Untitled ${n.level_type}`}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.addFormMeta}>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={form.reader_knows}
            onChange={(e) => set({ reader_knows: e.target.checked })}
          />
          Reader knows
        </label>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={form.is_truth}
            onChange={(e) => set({ is_truth: e.target.checked })}
          />
          Is truth (not misdirection)
        </label>
      </div>
      <input
        className={styles.addInput}
        value={form.characters_who_know}
        onChange={(e) => set({ characters_who_know: e.target.value })}
        placeholder="Characters who know (comma-separated)"
      />
      <div className={styles.addFormActions}>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
        <button className={styles.saveBtn} onClick={onSave} disabled={!form.subject.trim()}>
          <Check size={12} /> Add event
        </button>
      </div>
    </div>
  );
}
