import { useCallback, useEffect, useState } from "react";
import { Orbit, Brain, Plus, Trash2, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { useAIAvailable } from "../../lib/mode";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { useStoryStore } from "../../stores/storyStore";
import type { KnowledgeType, ReaderKnowledgeEvent, StructureNode, Twist } from "../../types";
import ConfirmDelete from "../lorebook/ConfirmDelete";
import { KNOWLEDGE_TYPE_META, emptyDraft, isIrony, type KnowledgeDraft } from "../../lib/twists/knowledge";
import KnowledgeEventForm from "./KnowledgeEventForm";
import styles from "./ReaderKnowledgeTimeline.module.css";

interface Props {
  storyId: string;
  /** Only the moments where the reader knows what the characters don't. */
  ironyOnly?: boolean;
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

function EventCard({
  event,
  names,
  onEdit,
  onDelete,
}: {
  event: ReaderKnowledgeEvent;
  names: (ids: string[]) => string[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = KNOWLEDGE_TYPE_META[event.knowledge_type as KnowledgeType] ?? {
    label: event.knowledge_type,
    color: "clue",
  };
  const who = names(event.characters_who_know);

  return (
    <div className={`${styles.eventCard} ${styles[`type_${meta.color}`]}`}>
      <div className={styles.eventCardHeader}>
        <button
          type="button"
          className={styles.eventToggle}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={`${styles.typeBadge} ${styles[`badge_${meta.color}`]}`}>{meta.label}</span>
          {!event.is_truth && event.knowledge_type !== "misdirection_planted" && (
            <span className={styles.falseBadge}>Not true</span>
          )}
          <span className={styles.eventSubject}>{event.subject}</span>
          {who.length > 0 && (
            <span className={styles.charKnowCount} title={who.join(", ")}>
              {who.length === 1 ? who[0] : `${who.length} know`}
            </span>
          )}
          <span className={styles.cardChevron}>
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        </button>
        <button type="button" className={styles.deleteBtn} onClick={onEdit} title="Edit" aria-label="Edit">
          <Pencil size={11} />
        </button>
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={onDelete}
          title="Delete"
          aria-label="Delete"
        >
          <Trash2 size={11} />
        </button>
      </div>
      {open && (
        <div className={styles.eventCardBody}>
          {event.detail && <p className={styles.eventDetail}>{event.detail}</p>}
          <div className={styles.eventMeta}>
            <span
              className={`${styles.metaChip} ${event.reader_knows ? styles.chipReaderYes : styles.chipReaderNo}`}
            >
              {event.reader_knows ? "The reader knows" : "The reader doesn't know yet"}
            </span>
            {who.length > 0 && <span className={styles.metaChip}>Who knows: {who.join(", ")}</span>}
            {event.twist_name && <span className={styles.metaChip}>Twist: {event.twist_name}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReaderKnowledgeTimeline({ storyId, ironyOnly = false }: Props) {
  const [events, setEvents] = useState<ReaderKnowledgeEvent[]>([]);
  const [nodes, setNodes] = useState<StructureNode[]>([]);
  const [twists, setTwists] = useState<Twist[]>([]);
  const characters = useStoryStore((s) => s.characters);
  const [loading, setLoading] = useState(true);
  // Writer mode keeps the timeline and loses only the scan, which asks the Assistant.
  const aiAvailable = useAIAvailable();
  const [scanning, setScanning] = useState(false);
  /** How many events the last scan proposed; -1 when it failed. */
  const [scanNote, setScanNote] = useState<number | null>(null);
  /** Where the form is open: "__unlinked__", a node id, or `edit:<event id>`. */
  const [formAt, setFormAt] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ReaderKnowledgeEvent | null>(null);

  const reload = useCallback(
    () =>
      Promise.all([
        api.listReaderKnowledgeEvents(storyId),
        api.getStructure(storyId),
        api.listTwists(storyId),
      ])
        .then(([evs, structure, tws]) => {
          setEvents(evs);
          setNodes(flattenNodes(structure));
          setTwists(tws);
        })
        .catch(() => {})
        .finally(() => setLoading(false)),
    [storyId],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  useReloadOnUndo(["reader_knowledge_event", "twist"], reload);

  const nameOf = new Map(characters.map((c) => [c.id, c.name]));
  const names = (ids: string[]) => ids.map((id) => nameOf.get(id)).filter((n): n is string => !!n);

  const displayedEvents = ironyOnly ? events.filter(isIrony) : events;

  // Group events by node_id (null = unlinked)
  const byNode = new Map<string | null, ReaderKnowledgeEvent[]>();
  for (const e of displayedEvents) {
    const key = e.node_id ?? null;
    if (!byNode.has(key)) byNode.set(key, []);
    byNode.get(key)!.push(e);
  }

  // Scenes in story order, then unlinked
  const orderedNodeIds: Array<{ id: string | null; title: string }> = [];
  for (const node of nodes) {
    if (byNode.has(node.id)) {
      orderedNodeIds.push({ id: node.id, title: node.title || `Untitled ${node.level_type}` });
    }
  }
  if (byNode.has(null)) orderedNodeIds.push({ id: null, title: "Not linked to a scene" });

  // The Assistant proposes; the author says yes in Proposals, where it can be undone (doc 13 P4).
  async function handleScan() {
    setScanning(true);
    setScanNote(null);
    try {
      const { proposed } = await api.scanReaderKnowledgeEvents(storyId);
      setScanNote(proposed);
    } catch {
      setScanNote(-1);
    } finally {
      setScanning(false);
    }
  }

  async function handleDelete(id: string) {
    await api.deleteReaderKnowledgeEvent(id).catch(() => {});
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleSave(draft: KnowledgeDraft, editing: ReaderKnowledgeEvent | null) {
    if (editing) {
      const saved = await api.updateReaderKnowledgeEvent(editing.id, draft);
      setEvents((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
    } else {
      await api.createReaderKnowledgeEvent(storyId, draft);
      await reload(); // the server keeps them in reading order
    }
    setFormAt(null);
  }

  const form = (initial: KnowledgeDraft, editing: ReaderKnowledgeEvent | null) => (
    <KnowledgeEventForm
      initial={initial}
      nodes={nodes}
      characters={characters}
      twists={twists}
      saveLabel={editing ? "Save" : "Add"}
      onSave={(d) => void handleSave(d, editing)}
      onCancel={() => setFormAt(null)}
    />
  );

  if (loading) return <p className={styles.loading}>Loading…</p>;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Brain size={15} className={styles.headerIcon} />
          <h3 className={styles.headerTitle}>
            {ironyOnly ? "Dramatic irony" : "What the reader knows, scene by scene"}
          </h3>
          <span className={styles.eventCount}>{displayedEvents.length}</span>
        </div>
        <div className={styles.headerRight}>
          {!ironyOnly && aiAvailable && (
            <button
              type="button"
              className={styles.scanBtn}
              onClick={handleScan}
              disabled={scanning}
              title="The Assistant reads the scenes for reveals, misdirections and clues; what it finds waits in Proposals"
            >
              <Orbit size={12} className={scanning ? styles.scanSpin : undefined} />
              {scanning ? "Reading…" : "Find what the reader learns"}
            </button>
          )}
          {!ironyOnly && (
            <button type="button" className={styles.addBtn} onClick={() => setFormAt("__unlinked__")}>
              <Plus size={12} />
              Add
            </button>
          )}
        </div>
      </div>

      {scanNote !== null && (
        <p className={styles.ironyHint} role="status">
          {scanNote < 0 ? (
            "The Assistant could not read the scenes just now."
          ) : scanNote === 0 ? (
            "Nothing new found."
          ) : (
            <>
              {scanNote} {scanNote === 1 ? "event waits" : "events wait"} for a yes in{" "}
              <Link to={`/stories/${storyId}/proposals?kind=fact`}>Proposals</Link>.
            </>
          )}
        </p>
      )}

      {ironyOnly && (
        <p className={styles.ironyHint}>
          The moments where the reader knows something the characters don&apos;t. That gap is dramatic irony.
        </p>
      )}

      {formAt === "__unlinked__" && form(emptyDraft(null), null)}

      {displayedEvents.length === 0 && (
        <div className={styles.empty}>
          <Brain size={18} className={styles.emptyIcon} />
          <p>
            {ironyOnly
              ? 'Nothing yet. Add one with "Only the reader knows" where the reader knows more than the characters.'
              : aiAvailable
                ? '"Find what the reader learns" asks the Assistant to propose what the reader learns where, or add it yourself.'
                : "Add what the reader learns, scene by scene: truths, misdirections, clues, and what only the reader knows."}
          </p>
        </div>
      )}

      <div className={styles.timeline}>
        {orderedNodeIds.map(({ id: nodeId, title: nodeTitle }) => {
          const nodeEvents = byNode.get(nodeId) ?? [];
          return (
            <div key={nodeId ?? "__unlinked__"} className={styles.timelineGroup}>
              <div className={styles.groupHeader}>
                <div className={styles.groupDot} />
                {nodeId ? (
                  <Link className={styles.groupTitle} to={`/stories/${storyId}/write/${nodeId}`}>
                    {nodeTitle}
                  </Link>
                ) : (
                  <span className={styles.groupTitle}>{nodeTitle}</span>
                )}
                {!ironyOnly && (
                  <button
                    type="button"
                    className={styles.groupAddBtn}
                    onClick={() => setFormAt(nodeId ?? "__unlinked__")}
                    title="Add here"
                    aria-label="Add here"
                  >
                    <Plus size={11} />
                  </button>
                )}
              </div>

              {nodeId && formAt === nodeId && form(emptyDraft(nodeId), null)}

              <div className={styles.groupEvents}>
                {nodeEvents.map((ev) =>
                  formAt === `edit:${ev.id}` ? (
                    <div key={ev.id}>{form({ ...ev }, ev)}</div>
                  ) : (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      names={names}
                      onEdit={() => setFormAt(`edit:${ev.id}`)}
                      onDelete={() => setDeleting(ev)}
                    />
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>

      {deleting && (
        <ConfirmDelete
          name={`“${deleting.subject}”`}
          onConfirm={() => void handleDelete(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
