import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../api/client";
import { slotVar } from "../../lib/colorSlots";
import { notifyPromisesChanged } from "../../lib/promises/usePromises";
import { toast } from "../../stores/toastStore";
import type { ClueTarget, Twist } from "../../types";
import styles from "./PromisePicker.module.css";

interface Props {
  kind: "clue" | "reveal";
  /** The selected words: a planted clue keeps them as its quote. */
  quote: string;
  rect: DOMRect;
  storyId: string;
  nodeId: string;
  onClose: () => void;
}

/**
 * "Plant a clue for…" and "Reveal a twist here…" on a selection (doc 18 C6): pick the twist,
 * or name a new one. A clue keeps the words it was planted on; a reveal moves the twist's
 * reveal to this scene. Both undo.
 */
export default function PromisePicker({ kind, quote, rect, storyId, nodeId, onClose }: Props) {
  const [twists, setTwists] = useState<Twist[] | null>(null);
  const [dir, setDir] = useState<ClueTarget>("truth");
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.listTwists(storyId).then(setTwists, () => setTwists([]));
  }, [storyId]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function choose(twist: Twist) {
    try {
      if (kind === "clue") {
        await api.createClue(twist.id, { node_id: nodeId, quote, points_to: dir, subtlety: "subtle" });
        toast.success(`Clue planted for ${twist.name}`);
      } else {
        await api.updateTwist(twist.id, { revealed_at_node_id: nodeId });
        toast.success(`${twist.name} is revealed here`);
      }
      notifyPromisesChanged();
      onClose();
    } catch {
      toast.error(kind === "clue" ? "The clue could not be planted" : "The reveal could not be moved");
    }
  }

  async function createAndChoose() {
    const n = name.trim();
    if (!n) return;
    await choose(await api.createTwist(storyId, { name: n }));
  }

  const top = rect.bottom + window.scrollY + 8;
  const left = Math.max(8, Math.min(rect.left + window.scrollX, window.innerWidth - 320));

  return createPortal(
    <div
      ref={ref}
      className={styles.picker}
      style={{ top, left }}
      role="dialog"
      aria-label={kind === "clue" ? "Plant a clue for a twist" : "Reveal a twist here"}
    >
      <p className={styles.title}>{kind === "clue" ? "Plant a clue for…" : "Reveal a twist here…"}</p>
      {kind === "clue" && quote && (
        <q className={styles.quote}>{quote.length > 140 ? `${quote.slice(0, 140)}…` : quote}</q>
      )}
      {kind === "clue" && (
        <div className={styles.toggle} role="radiogroup" aria-label="Which way it points">
          {(["truth", "misdirection"] as const).map((d) => (
            <button key={d} type="button" role="radio" aria-checked={dir === d} onClick={() => setDir(d)}>
              {d === "truth" ? "Toward the truth" : "Away from it"}
            </button>
          ))}
        </div>
      )}
      <div className={styles.list}>
        {twists === null ? (
          <p className={styles.quiet}>Loading twists…</p>
        ) : (
          twists.map((t) => (
            <button
              key={t.id}
              type="button"
              className={styles.twist}
              style={{ "--lane": slotVar(t.color_slot) } as React.CSSProperties}
              onClick={() => void choose(t)}
            >
              <span className={styles.diamond} aria-hidden />
              <span className={styles.twistName}>{t.name}</span>
              {kind === "reveal" && t.revealed_at_node_id && t.revealed_at_node_id !== nodeId && (
                <span className={styles.quiet}>moves its reveal</span>
              )}
            </button>
          ))
        )}
      </div>
      <form
        className={styles.newRow}
        onSubmit={(e) => {
          e.preventDefault();
          void createAndChoose();
        }}
      >
        <input
          aria-label="A new twist"
          placeholder={twists?.length ? "Or a new twist…" : "Name the twist…"}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>
    </div>,
    document.body,
  );
}
