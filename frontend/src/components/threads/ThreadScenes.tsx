import { Plus, X } from "lucide-react";
import { api } from "../../api/client";
import { ROLES, roleHint } from "../../lib/threads/roles";
import type { PlotThread, StructureNode, ThreadRole } from "../../types";
import CommitInput from "../common/CommitInput";
import styles from "./ThreadScenes.module.css";

interface Props {
  thread: PlotThread;
  /** Every scene, in reading order. */
  leaves: StructureNode[];
  /** After any change, so the story's copy of the thread follows. */
  onChanged: () => void;
  onOpenScene: (nodeId: string) => void;
}

/**
 * A thread scene by scene (doc 18 C1): what each scene does to it, in a word and in the
 * author's own note. Opening, closing and the tries along the way are roles here, not
 * separate fields.
 */
export default function ThreadScenes({ thread, leaves, onChanged, onOpenScene }: Props) {
  const on = new Map(thread.appearances.map((a) => [a.node_id, a]));
  const rows = leaves.filter((n) => on.has(n.id));
  const rest = leaves.filter((n) => !on.has(n.id));

  async function run(p: Promise<unknown>) {
    await p;
    onChanged();
  }

  return (
    <section className={styles.wrap} aria-label="Scene by scene">
      <div className={styles.head}>
        <span className={styles.title}>Scene by scene</span>
        <span className={styles.meta}>What each scene does to it, in your words</span>
      </div>
      {rows.length === 0 && (
        <p className={styles.empty}>
          In no scene yet. Add the scene where the reader first feels it, then the ones that move it on.
        </p>
      )}
      {rows.map((n) => {
        const a = on.get(n.id)!;
        return (
          <div key={n.id} className={styles.row}>
            <button type="button" className={styles.scene} onClick={() => onOpenScene(n.id)} title={n.title}>
              {n.title || "Untitled scene"}
            </button>
            <select
              aria-label={`What “${n.title || "this scene"}” does to the thread`}
              className={styles.role}
              data-role={a.role}
              value={a.role}
              title={roleHint(a.role)}
              onChange={(e) =>
                void run(api.updateThreadAppearance(thread.id, n.id, { role: e.target.value as ThreadRole }))
              }
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <CommitInput
              className={styles.note}
              value={a.note}
              placeholder="What happens to it here?"
              aria-label={`Note on “${n.title || "this scene"}”`}
              onCommit={(note) => void run(api.updateThreadAppearance(thread.id, n.id, { note }))}
            />
            <button
              type="button"
              className={styles.remove}
              aria-label={`Take “${n.title || "this scene"}” off the thread`}
              title="Take this scene off the thread"
              onClick={() => void run(api.removeThreadAppearance(thread.id, n.id))}
            >
              <X size={12} aria-hidden />
            </button>
          </div>
        );
      })}
      {rest.length > 0 && (
        <label className={styles.add}>
          <Plus size={12} aria-hidden />
          <select
            aria-label="Add a scene to the thread"
            value=""
            onChange={(e) => e.target.value && void run(api.addThreadAppearance(thread.id, e.target.value))}
          >
            <option value="">Add a scene</option>
            {rest.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title || "Untitled scene"}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}
