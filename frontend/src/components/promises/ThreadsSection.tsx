import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Map as MapIcon, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { KINDS } from "../../lib/lorebook/kinds";
import { presenceLine, scenesWith } from "../../lib/lorebook/presence";
import { sceneLeaves } from "../../lib/planning/methods";
import { slotVar, nextSlot } from "../../lib/colorSlots";
import { sectionPath } from "../../lib/routes";
import { refreshThreads } from "../../lib/story/refreshThreads";
import { kindLabel, THREAD_KINDS } from "../../lib/threads/kinds";
import { relations, triesLine } from "../../lib/threads/relations";
import { STATUS_LABELS, statusLine } from "../../lib/threads/roles";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import type { PlotThread } from "../../types";
import MICEGuide from "../help/MICEGuide";
import ThreadAnalysisPanel from "../threads/ThreadAnalysisPanel";
import ThreadScenes from "../threads/ThreadScenes";
import AssistantRow from "../lorebook/AssistantRow";
import HealthCard from "../lorebook/HealthCard";
import ConfirmDelete from "../lorebook/ConfirmDelete";
import EntitySheet, { Badge, SheetCard } from "../lorebook/EntitySheet";
import FieldList from "../lorebook/FieldList";
import LorebookList from "../lorebook/LorebookList";
import { useLoreSelection } from "../lorebook/useLoreSelection";
import styles from "../lorebook/Lorebook.module.css";
import p from "./Promises.module.css";

/**
 * Plot threads, under Promises (doc 18 C3). With none open, the map of every thread across
 * the book; open one and it is the same sheet as everything else, with its MICE shape and its
 * scenes, each saying what it does to the thread (doc 18 C1: opening, closing and the tries
 * along the way are roles on those scenes, and the status follows from them); beside it, what
 * kind of promise it is, where it stands and how it sits with the other threads (C5).
 */
export default function ThreadsSection() {
  const { threads, setThreads, upsertThread, sceneCast, structure, activeTemplate } = useStoryStore();
  const openEntity = usePanelStore((s) => s.openEntity);
  const navigate = useNavigate();
  const { storyId, selectedId, select } = useLoreSelection(
    "threads",
    threads.map((t) => t.id),
    true,
    "promises",
  );
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PlotThread | null>(null);
  const [analysing, setAnalysing] = useState<string | null>(null);
  const [guide, setGuide] = useState(false);
  useReloadOnUndo(
    ["plot_thread", "plot_thread_appearance"],
    () => void api.listThreads(storyId).then(setThreads),
  );

  const thread = threads.find((t) => t.id === selectedId) ?? null;
  const leaves = sceneLeaves(structure, activeTemplate);
  const scenes = thread ? scenesWith("thread", thread.id, sceneCast, structure, activeTemplate) : [];
  const sceneTitle = (id: string | null) => leaves.find((n) => n.id === id)?.title || "Untitled scene";
  const index = new Map(leaves.map((n, i) => [n.id, i]));
  const refresh = () => void refreshThreads(storyId);

  async function add() {
    const created = await api.createThread(storyId, {
      name: "New thread",
      color_slot: nextSlot(threads.map((t) => t.color_slot)),
    });
    upsertThread(created);
    setRenaming(created.id);
    select(created.id);
  }

  async function save(patch: Parameters<typeof api.updateThread>[1]) {
    if (!thread) return;
    upsertThread(await api.updateThread(thread.id, patch));
  }

  return (
    <div className={styles.section}>
      <LorebookList
        title="Plot threads"
        items={threads.map((t) => ({
          id: t.id,
          name: t.name,
          sub: [kindLabel(t.mice_type), STATUS_LABELS[t.status].toLowerCase()].filter(Boolean).join(" · "),
          dot: slotVar(t.color_slot),
        }))}
        selectedId={selectedId}
        onSelect={(id) => select(id)}
        onAdd={add}
        empty={<p className={styles.listEmpty}>No threads yet. The questions the story keeps open.</p>}
        footer={
          threads.length > 0 && (
            <div className={styles.listFooter}>
              <Link className={styles.quietBtn} to={sectionPath(storyId, "promises", "tapestry")}>
                <MapIcon size={11} aria-hidden />
                Every thread on the tapestry
              </Link>
            </div>
          )
        }
      />
      <div className={styles.sheetScroll}>
        {thread ? (
          <EntitySheet
            key={thread.id}
            entityKey={thread.id}
            name={thread.name}
            startRenaming={renaming === thread.id}
            onRename={(name) => {
              setRenaming(null);
              return save({ name });
            }}
            dot={slotVar(thread.color_slot)}
            slot={{ value: thread.color_slot, onChange: (color_slot) => void save({ color_slot }) }}
            badges={
              <>
                <Badge>{STATUS_LABELS[thread.status]}</Badge>
                {thread.mice_type && (
                  <Badge title={`MICE: ${thread.mice_type}`}>{kindLabel(thread.mice_type)}</Badge>
                )}
              </>
            }
            presence={presenceLine(scenes, leaves.length, "Runs through")}
            scenes={scenes}
            onOpenBeside={() => openEntity("thread", thread.id, thread.name)}
            more={[
              { label: "How threads work", icon: BookOpen, onSelect: () => navigate("/guides/promises") },
              { label: "What is a MICE thread?", icon: BookOpen, onSelect: () => setGuide(true) },
              { label: "Delete thread", icon: Trash2, danger: true, onSelect: () => setDeleting(thread) },
            ]}
            side={
              <>
                <HealthCard anchor="thread_id" id={thread.id} storyId={storyId} />
                <SheetCard title="What kind of promise">
                  <div className={p.kindCards} role="radiogroup" aria-label="What kind of promise">
                    {THREAD_KINDS.map((k) => (
                      <button
                        key={k.value}
                        type="button"
                        role="radio"
                        aria-checked={thread.mice_type === k.value}
                        className={`${p.kindCard} ${thread.mice_type === k.value ? p.kindCardOn : ""}`}
                        onClick={() =>
                          void save({ mice_type: thread.mice_type === k.value ? null : k.value })
                        }
                      >
                        <span className={p.kindLabel}>{k.label}</span>
                        <span className={p.kindHint}>{k.hint}</span>
                      </button>
                    ))}
                  </div>
                  <p className={p.smallPrint}>Mary Robinette Kowal’s MICE: milieu, idea, character, event.</p>
                </SheetCard>
                <SheetCard title="Where it stands">
                  <p className={p.cardText}>{statusLine(thread, sceneTitle)}</p>
                  <button
                    type="button"
                    className={styles.quietBtn}
                    aria-pressed={thread.set_aside}
                    onClick={() => void save({ set_aside: !thread.set_aside })}
                  >
                    {thread.set_aside ? "Pick it up again" : "Set it aside"}
                  </button>
                </SheetCard>
                <SheetCard title="With the other threads">
                  {relations(thread, threads, index).map((line) => (
                    <p key={line} className={p.cardText}>
                      {line}
                    </p>
                  ))}
                  <p className={styles.cardHint}>{triesLine(thread, index)}</p>
                </SheetCard>
              </>
            }
            footer={
              <>
                {analysing === thread.id && <ThreadAnalysisPanel threadId={thread.id} />}
                <AssistantRow
                  actions={[
                    {
                      label: analysing === thread.id ? "Hide the analysis" : "Analyse thread",
                      title: "Setup, escalation, payoff and what is missing",
                      onRun: () => setAnalysing((a) => (a === thread.id ? null : thread.id)),
                    },
                  ]}
                />
              </>
            }
          >
            <FieldList
              entityKey={thread.id}
              fields={KINDS.thread.fields}
              values={thread as unknown as Record<string, unknown>}
              save={(key, value) => save({ [key]: value })}
            />
            <ThreadScenes
              thread={thread}
              color={slotVar(thread.color_slot)}
              leaves={leaves}
              onChanged={refresh}
              onOpenScene={(id) => navigate(`/stories/${storyId}/write/${id}`)}
            />
          </EntitySheet>
        ) : (
          <div className={styles.landing}>
            <div className={styles.emptySheet}>
              {threads.length === 0 && <p>Add the first thread: a question the reader will want answered.</p>}
            </div>
          </div>
        )}
      </div>
      {guide && <MICEGuide onClose={() => setGuide(false)} />}
      {deleting && (
        <ConfirmDelete
          name={deleting.name}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api.deleteThread(deleting.id);
            setThreads(threads.filter((t) => t.id !== deleting.id));
            select(null, { replace: true });
          }}
        />
      )}
    </div>
  );
}
