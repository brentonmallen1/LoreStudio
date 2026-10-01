import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Map as MapIcon, Trash2 } from "lucide-react";
import { api } from "../../../api/client";
import { useReloadOnUndo } from "../../../hooks/useUndoRedo";
import { KINDS } from "../../../lib/lorebook/kinds";
import { presenceLine, scenesWith } from "../../../lib/lorebook/presence";
import { sceneLeaves } from "../../../lib/planning/methods";
import { slotVar, nextSlot } from "../../../lib/colorSlots";
import { usePanelStore } from "../../../stores/panelStore";
import { useStoryStore } from "../../../stores/storyStore";
import type { MICEType, PlotThread } from "../../../types";
import MICEGuide from "../../help/MICEGuide";
import ThreadAnalysisPanel from "../../threads/ThreadAnalysisPanel";
import ThreadVisualization from "../../threads/ThreadVisualization";
import TryFailCycleEditor from "../../threads/TryFailCycleEditor";
import AssistantRow from "../AssistantRow";
import ConfirmDelete from "../ConfirmDelete";
import EntitySheet, { Badge, CardRow, SheetCard } from "../EntitySheet";
import FieldList from "../FieldList";
import LorebookList from "../LorebookList";
import { useLoreSelection } from "../useLoreSelection";
import styles from "../Lorebook.module.css";

const STATUSES: PlotThread["status"][] = ["open", "developing", "resolved"];
const MICE: { value: MICEType; label: string; hint: string }[] = [
  { value: "milieu", label: "Milieu", hint: "Opens on entering a place, closes on leaving it" },
  { value: "idea", label: "Idea", hint: "Opens with a question, closes with its answer" },
  {
    value: "character",
    label: "Character",
    hint: "Opens with dissatisfaction, closes with change or acceptance",
  },
  { value: "event", label: "Event", hint: "Opens with a disruption, closes with a new balance" },
];

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Plot threads in the Lorebook (doc 12 D5). With none open, the map of every thread across
 * the book; open one and it is the same sheet as everything else, with its MICE shape, the
 * scenes it opens and closes in, and its try/fail cycles.
 */
export default function ThreadsSection() {
  const { threads, setThreads, upsertThread, sceneCast, structure, activeTemplate } = useStoryStore();
  const openEntity = usePanelStore((s) => s.openEntity);
  const navigate = useNavigate();
  const { storyId, selectedId, select } = useLoreSelection(
    "threads",
    threads.map((t) => t.id),
    false,
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
  const sceneTitle = (id: string | null) => leaves.find((n) => n.id === id)?.title;

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
          sub: [label(t.status), t.mice_type ? label(t.mice_type) : ""].filter(Boolean).join(" · "),
          dot: slotVar(t.color_slot),
        }))}
        selectedId={selectedId}
        onSelect={(id) => select(id)}
        onAdd={add}
        empty={<p className={styles.listEmpty}>No threads yet. The questions the story keeps open.</p>}
        footer={
          threads.length > 0 && (
            <div className={styles.listFooter}>
              <button
                type="button"
                className={styles.quietBtn}
                onClick={() => select(null)}
                aria-pressed={!thread}
              >
                <MapIcon size={11} aria-hidden />
                Map of every thread
              </button>
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
                <Badge>{label(thread.status)}</Badge>
                {thread.mice_type && <Badge>{label(thread.mice_type)} thread</Badge>}
              </>
            }
            presence={presenceLine(scenes, leaves.length, "Runs through")}
            scenes={scenes}
            onOpenBeside={() => openEntity("thread", thread.id, thread.name)}
            more={[
              { label: "What is a MICE thread?", icon: BookOpen, onSelect: () => setGuide(true) },
              { label: "Delete thread", icon: Trash2, danger: true, onSelect: () => setDeleting(thread) },
            ]}
            side={
              <>
                <SheetCard title="Shape">
                  <div className={styles.rowEdit}>
                    <select
                      aria-label="Status"
                      className={styles.grow}
                      value={thread.status}
                      onChange={(e) => void save({ status: e.target.value })}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {label(s)}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="MICE type"
                      className={styles.grow}
                      value={thread.mice_type ?? ""}
                      title={MICE.find((m) => m.value === thread.mice_type)?.hint}
                      onChange={(e) => void save({ mice_type: (e.target.value || null) as MICEType | null })}
                    >
                      <option value="">No MICE type</option>
                      {MICE.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {thread.mice_type && (
                    <>
                      <p className={styles.cardHint}>
                        {MICE.find((m) => m.value === thread.mice_type)?.hint}.
                      </p>
                      {(["opens_at_node_id", "closes_at_node_id"] as const).map((key) => (
                        <label key={key} className={styles.rowEdit}>
                          <span className={styles.rowLabel}>
                            {key === "opens_at_node_id" ? "Opens in" : "Closes in"}
                          </span>
                          <select
                            className={styles.grow}
                            value={thread[key] ?? ""}
                            onChange={(e) => void save({ [key]: e.target.value || null })}
                          >
                            <option value="">Not decided</option>
                            {leaves.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.title || "Untitled scene"}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </>
                  )}
                </SheetCard>
                <SheetCard title="Scenes" meta={scenes.length || undefined}>
                  {scenes.length === 0 ? (
                    <p className={styles.cardEmpty}>
                      Not placed in a scene yet. Add it from a scene’s notes.
                    </p>
                  ) : (
                    scenes.map((s) => (
                      <CardRow
                        key={s.id}
                        text={s.title}
                        note={
                          s.id === thread.opens_at_node_id
                            ? "opens"
                            : s.id === thread.closes_at_node_id
                              ? "closes"
                              : undefined
                        }
                        onClick={() => navigate(`/stories/${storyId}/write/${s.id}`)}
                      />
                    ))
                  )}
                  {thread.opens_at_node_id && !scenes.some((s) => s.id === thread.opens_at_node_id) && (
                    <CardRow text={sceneTitle(thread.opens_at_node_id)} note="opens" />
                  )}
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
            <TryFailCycleEditor
              cycles={thread.try_fail_cycles}
              nodes={leaves}
              onChange={(try_fail_cycles) => void save({ try_fail_cycles })}
            />
          </EntitySheet>
        ) : (
          <div className={styles.landing}>
            {threads.length > 0 ? (
              <>
                <div className={styles.landingHeader}>
                  <h2 className={styles.landingTitle}>Every thread across the book</h2>
                  <p className={styles.cardHint}>
                    Open a thread from the list for its sheet. Click a scene to go to it.
                  </p>
                </div>
                <ThreadVisualization storyId={storyId} />
              </>
            ) : (
              <div className={styles.emptySheet}>
                <p>Add the first thread: a question the reader will want answered.</p>
              </div>
            )}
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
