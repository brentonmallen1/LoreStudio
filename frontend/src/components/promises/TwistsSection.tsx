import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { KINDS } from "../../lib/lorebook/kinds";
import { useAIAvailable } from "../../lib/mode";
import { sceneLeaves } from "../../lib/planning/methods";
import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import type { Twist, TwistType } from "../../types";
import TwistAnalysisPanel from "../twists/TwistAnalysisPanel";
import TwistClueEditor from "../twists/TwistClueEditor";
import TwistImpactPanel from "../twists/TwistImpactPanel";
import AssistantRow from "../lorebook/AssistantRow";
import HealthCard from "../lorebook/HealthCard";
import ConfirmDelete from "../lorebook/ConfirmDelete";
import EntitySheet, { Badge, CardRow, SheetCard } from "../lorebook/EntitySheet";
import FieldList from "../lorebook/FieldList";
import LorebookList from "../lorebook/LorebookList";
import { useLoreSelection } from "../lorebook/useLoreSelection";
import { TYPES, cluesLine, statusLabel, typeLabel } from "../../lib/twists/labels";
import { slotVar } from "../../lib/colorSlots";
import { sectionPath } from "../../lib/routes";
import styles from "../lorebook/Lorebook.module.css";

/**
 * Twists, under Promises (doc 18 C3): each twist's truth, its misdirection, where it lands and
 * the clues that point either way. What the reader knows has a section of its own.
 */
export default function TwistsSection() {
  const { structure, activeTemplate } = useStoryStore();
  const openEntity = usePanelStore((s) => s.openEntity);
  const navigate = useNavigate();
  const [twists, setTwists] = useState<Twist[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { storyId, selectedId, select } = useLoreSelection(
    "twists",
    twists.map((t) => t.id),
    true,
    "promises",
  );
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Twist | null>(null);
  const [panel, setPanel] = useState<"analysis" | "impact" | null>(null);
  // Twists are planning, in both modes; the analysis and impact panels are the Assistant's.
  const aiAvailable = useAIAvailable();

  const reload = useCallback(
    () =>
      api.listTwists(storyId).then((rows) => {
        setTwists(rows);
        setLoaded(true);
      }),
    [storyId],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  useReloadOnUndo(["twist", "twist_clue", "reader_knowledge_event"], () => void reload());

  const twist = twists.find((t) => t.id === selectedId) ?? null;
  const leaves = sceneLeaves(structure, activeTemplate);
  const titleOf = (id: string | null) => leaves.find((n) => n.id === id)?.title ?? "Untitled scene";

  async function add() {
    const created = await api.createTwist(storyId, { name: "New twist", twist_type: "reveal" });
    setTwists((t) => [...t, created]);
    setRenaming(created.id);
    select(created.id);
  }

  async function save(patch: Parameters<typeof api.updateTwist>[1]) {
    if (!twist) return;
    const saved = await api.updateTwist(twist.id, patch);
    setTwists((all) => all.map((t) => (t.id === saved.id ? saved : t)));
  }

  const toTruth = twist?.clues.filter((c) => c.points_to === "truth").length ?? 0;

  return (
    <div className={styles.section}>
      <LorebookList
        title="Twists"
        items={twists.map((t) => ({
          id: t.id,
          name: t.name,
          sub: `${typeLabel(t.twist_type)} · ${statusLabel(t.status)} · ${t.clues.length} ${t.clues.length === 1 ? "clue" : "clues"}`,
        }))}
        selectedId={selectedId}
        onSelect={(id) => {
          setPanel(null);
          select(id);
        }}
        onAdd={add}
        empty={
          loaded ? (
            <p className={styles.listEmpty}>
              No twists yet. What the reader will learn, and how you hide it.
            </p>
          ) : null
        }
        footer={
          <div className={styles.listFooter}>
            <Link className={styles.quietBtn} to={sectionPath(storyId, "promises", "reader")}>
              <Eye size={11} aria-hidden />
              What the reader knows
            </Link>
          </div>
        }
      />
      <div className={styles.sheetScroll}>
        {twist ? (
          <EntitySheet
            key={twist.id}
            entityKey={twist.id}
            name={twist.name}
            startRenaming={renaming === twist.id}
            onRename={(name) => {
              setRenaming(null);
              return save({ name });
            }}
            dot={slotVar(twist.color_slot)}
            slot={{ value: twist.color_slot, onChange: (color_slot) => void save({ color_slot }) }}
            badges={
              <>
                <Badge title={TYPES.find((t) => t.value === twist.twist_type)?.hint}>
                  {typeLabel(twist.twist_type)}
                </Badge>
                <Badge>{statusLabel(twist.status)}</Badge>
              </>
            }
            presence={
              twist.revealed_at_node_id
                ? `Revealed in ${titleOf(twist.revealed_at_node_id)} · ${cluesLine(twist)}`
                : `Not revealed yet · ${cluesLine(twist)}`
            }
            onOpenBeside={() => openEntity("twist", twist.id, twist.name)}
            more={[{ label: "Delete twist", icon: Trash2, danger: true, onSelect: () => setDeleting(twist) }]}
            side={
              <>
                <HealthCard anchor="twist_id" id={twist.id} storyId={storyId} />
                <SheetCard title="Shape">
                  <div className={styles.rowEdit}>
                    <select
                      aria-label="Type"
                      className={styles.grow}
                      value={twist.twist_type}
                      onChange={(e) => void save({ twist_type: e.target.value as TwistType })}
                    >
                      {TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className={styles.rowEdit}>
                    <span className={styles.rowLabel}>Revealed in</span>
                    <select
                      className={styles.grow}
                      value={twist.revealed_at_node_id ?? ""}
                      onChange={(e) => void save({ revealed_at_node_id: e.target.value || null })}
                    >
                      <option value="">Not decided</option>
                      {leaves.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title || "Untitled scene"}
                        </option>
                      ))}
                    </select>
                  </label>
                </SheetCard>
                <SheetCard
                  title="Clues"
                  meta={
                    twist.clues.length
                      ? `${toTruth} to the truth · ${twist.clues.length - toTruth} away`
                      : undefined
                  }
                >
                  {twist.clues.length === 0 ? (
                    <p className={styles.cardEmpty}>None planted yet.</p>
                  ) : (
                    twist.clues.map((c) => (
                      <CardRow
                        key={c.id}
                        dot={c.points_to === "truth" ? "var(--color-success)" : "var(--color-warning)"}
                        text={c.text || "A clue"}
                        under={[c.node_id ? titleOf(c.node_id) : "", c.subtlety].filter(Boolean).join(" · ")}
                        onClick={
                          c.node_id ? () => navigate(`/stories/${storyId}/write/${c.node_id}`) : undefined
                        }
                      />
                    ))
                  )}
                </SheetCard>
              </>
            }
            footer={
              <>
                {aiAvailable && panel === "analysis" && (
                  <TwistAnalysisPanel twistId={twist.id} onClueLinked={() => void reload()} />
                )}
                {aiAvailable && panel === "impact" && (
                  <TwistImpactPanel twistId={twist.id} twistName={twist.name} />
                )}
                <AssistantRow
                  actions={[
                    {
                      label: panel === "analysis" ? "Hide the analysis" : "Analyse the twist",
                      title: "Fairness, misdirection, clue placement",
                      onRun: () => setPanel((p) => (p === "analysis" ? null : "analysis")),
                    },
                    {
                      label: panel === "impact" ? "Hide the impact" : "Impact of the reveal",
                      title: "What the reveal changes for each character and thread",
                      onRun: () => setPanel((p) => (p === "impact" ? null : "impact")),
                    },
                  ]}
                />
              </>
            }
          >
            <FieldList
              entityKey={twist.id}
              fields={KINDS.twist.fields}
              values={twist as unknown as Record<string, unknown>}
              save={(key, value) => save({ [key]: value } as Parameters<typeof api.updateTwist>[1])}
            />
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Clues</span>
              <TwistClueEditor twist={twist} nodes={leaves} onChanged={() => void reload()} />
            </div>
          </EntitySheet>
        ) : (
          <div className={styles.landing}>
            <div className={styles.emptySheet}>
              <p>
                {loaded
                  ? "Add the first twist: a truth the reader will learn late, and what they believe until then."
                  : null}
              </p>
            </div>
          </div>
        )}
      </div>
      {deleting && (
        <ConfirmDelete
          name={deleting.name}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api.deleteTwist(deleting.id);
            setTwists((all) => all.filter((t) => t.id !== deleting.id));
            select(null, { replace: true });
          }}
        />
      )}
    </div>
  );
}
