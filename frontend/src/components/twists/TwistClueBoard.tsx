import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import { slotVar } from "../../lib/colorSlots";
import type { StructureNode, SubtletyLevel, Twist, TwistClue } from "../../types";
import CommitTextarea from "../common/CommitTextarea";
import styles from "./TwistClueBoard.module.css";

const SUBTLETIES: { value: SubtletyLevel; label: string; hint: string }[] = [
  { value: "obvious", label: "obvious", hint: "Most readers will notice it" },
  { value: "moderate", label: "moderate", hint: "An attentive reader will notice it" },
  { value: "subtle", label: "subtle", hint: "Only a careful reader will catch it" },
  { value: "hidden", label: "hidden", hint: "It only makes sense once you know" },
];

interface Props {
  twist: Twist;
  /** Every scene, in reading order. */
  leaves: StructureNode[];
  onChanged: () => void;
}

/**
 * A twist's clues in reading order (doc 18 C5): a column for each scene that holds a clue, the
 * reveal's column in the twist's colour, and the clues not placed yet at the end. Pick a clue
 * to change it; plant one from here, or from the words themselves in a scene.
 */
export default function TwistClueBoard({ twist, leaves, onChanged }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const index = new Map(leaves.map((n, i) => [n.id, i]));
  const columns = new Map<string, TwistClue[]>();
  for (const c of twist.clues) {
    const key = c.node_id && index.has(c.node_id) ? c.node_id : "";
    columns.set(key, [...(columns.get(key) ?? []), c]);
  }
  const reveal =
    twist.revealed_at_node_id && index.has(twist.revealed_at_node_id) ? twist.revealed_at_node_id : null;
  if (reveal && !columns.has(reveal)) columns.set(reveal, []);
  const order = [...columns.keys()].filter(Boolean).sort((a, b) => index.get(a)! - index.get(b)!);
  if (columns.has("")) order.push("");
  const revealAt = reveal ? index.get(reveal)! : Infinity;
  const title = (id: string) => leaves[index.get(id)!]?.title || "Untitled scene";
  const editing = twist.clues.find((c) => c.id === open) ?? null;

  async function plant() {
    const clue = await api.createClue(twist.id, { subtlety: "subtle" });
    onChanged();
    setOpen(clue.id);
  }

  return (
    <section
      className={styles.board}
      aria-label="Clues, in reading order"
      style={{ "--twist": slotVar(twist.color_slot) } as React.CSSProperties}
    >
      <div className={styles.head}>
        <span className={styles.title}>Clues, in reading order</span>
        <button type="button" className={styles.plant} onClick={() => void plant()}>
          <Plus size={12} aria-hidden />
          Plant a clue
        </button>
      </div>
      {order.length === 0 ? (
        <p className={styles.empty}>
          No clues yet. A clue is a detail that points toward the truth, or away from it, before the reveal.
        </p>
      ) : (
        <div className={styles.columns}>
          {order.map((key) => {
            const at = key ? index.get(key)! : null;
            const after = at !== null && at > revealAt;
            return (
              <div key={key || "unplaced"} className={styles.column}>
                <div className={`${styles.colHead} ${key === reveal ? styles.colReveal : ""}`}>
                  {key ? title(key) : "Not placed yet"}
                  {after && <span className={styles.after}> · after the reveal</span>}
                </div>
                {(columns.get(key) ?? []).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.card} ${c.points_to === "truth" ? styles.toward : styles.away} ${open === c.id ? styles.cardOpen : ""}`}
                    aria-expanded={open === c.id}
                    onClick={() => setOpen(open === c.id ? null : c.id)}
                  >
                    <span className={styles.dir}>
                      {c.points_to === "truth" ? "Toward the truth" : "Away from it"} · {c.subtlety}
                    </span>
                    <span className={styles.text}>
                      {c.text || (c.quote ? "Planted on the words below" : "A clue, not described yet")}
                    </span>
                    {c.quote && <q className={styles.quote}>{c.quote}</q>}
                  </button>
                ))}
                {key === reveal && (
                  <div className={styles.revealCard}>
                    <span className={styles.dir}>The reveal</span>
                    <span className={styles.text}>{twist.the_truth || "The truth comes out here."}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {editing && (
        <ClueEditor
          key={editing.id}
          clue={editing}
          leaves={leaves}
          onChanged={onChanged}
          onDeleted={() => {
            setOpen(null);
            onChanged();
          }}
        />
      )}
    </section>
  );
}

function ClueEditor({
  clue,
  leaves,
  onChanged,
  onDeleted,
}: {
  clue: TwistClue;
  leaves: StructureNode[];
  onChanged: () => void;
  onDeleted: () => void;
}) {
  async function save(patch: Partial<TwistClue>) {
    await api.updateClue(clue.id, patch);
    onChanged();
  }
  return (
    <div className={styles.editor} role="group" aria-label="This clue">
      <CommitTextarea
        className={styles.editText}
        value={clue.text}
        placeholder="What the reader notices…"
        aria-label="The clue"
        onCommit={(text) => void save({ text })}
      />
      <div className={styles.editRow}>
        <div className={styles.toggle} role="radiogroup" aria-label="Which way it points">
          {(["truth", "misdirection"] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              role="radio"
              aria-checked={clue.points_to === dir}
              className={clue.points_to === dir ? styles.toggleOn : ""}
              onClick={() => void save({ points_to: dir })}
            >
              {dir === "truth" ? "Toward the truth" : "Away from it"}
            </button>
          ))}
        </div>
        <select
          aria-label="How subtle"
          value={clue.subtlety}
          title={SUBTLETIES.find((s) => s.value === clue.subtlety)?.hint}
          onChange={(e) => void save({ subtlety: e.target.value as SubtletyLevel })}
        >
          {SUBTLETIES.map((s) => (
            <option key={s.value} value={s.value} title={s.hint}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          aria-label="The scene it is in"
          value={clue.node_id ?? ""}
          onChange={(e) => void save({ node_id: e.target.value || null })}
        >
          <option value="">Not placed yet</option>
          {leaves.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title || "Untitled scene"}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.delete}
          aria-label="Delete this clue"
          title="Delete this clue"
          onClick={() => void api.deleteClue(clue.id).then(onDeleted)}
        >
          <Trash2 size={13} aria-hidden />
        </button>
      </div>
    </div>
  );
}
