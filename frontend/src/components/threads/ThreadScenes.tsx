import { Plus, X } from "lucide-react";
import { api } from "../../api/client";
import { ROLES, roleHint } from "../../lib/threads/roles";
import type { PlotThread, StructureNode, ThreadRole } from "../../types";
import CommitTextarea from "../common/CommitTextarea";
import styles from "./ThreadScenes.module.css";

interface Props {
  thread: PlotThread;
  /** The thread's colour, for the role marks. */
  color: string;
  /** Every scene, in reading order. */
  leaves: StructureNode[];
  /** After any change, so the story's copy of the thread follows. */
  onChanged: () => void;
  onOpenScene: (nodeId: string) => void;
}

/**
 * A thread scene by scene (doc 18 C5): from the first scene it is in to the last, what each
 * does to it, in a word and in the author's own note. A scene in between that leaves it alone
 * says so, quietly, so a long silence shows.
 */
export default function ThreadScenes({ thread, color, leaves, onChanged, onOpenScene }: Props) {
  const on = new Map(thread.appearances.map((a) => [a.node_id, a]));
  const at = leaves.map((n, i) => (on.has(n.id) ? i : -1)).filter((i) => i >= 0);
  const span = at.length ? leaves.slice(at[0], at[at.length - 1] + 1) : [];
  const rest = leaves.filter((n) => !on.has(n.id));

  async function run(p: Promise<unknown>) {
    await p;
    onChanged();
  }

  return (
    <section
      className={styles.wrap}
      aria-label="Scene by scene"
      style={{ "--lane": color } as React.CSSProperties}
    >
      <div className={styles.head}>
        <span className={styles.title}>Scene by scene</span>
        <span className={styles.meta}>What each scene does to it, in your words</span>
      </div>
      {span.length === 0 && (
        <p className={styles.empty}>
          In no scene yet. Add the scene where the reader first feels it, then the ones that move it on.
        </p>
      )}
      {span.map((n) => {
        const a = on.get(n.id);
        const name = n.title || "Untitled scene";
        if (!a) {
          return (
            <div key={n.id} className={`${styles.row} ${styles.absent}`}>
              <button type="button" className={styles.scene} onClick={() => onOpenScene(n.id)} title={name}>
                {name}
              </button>
              <span className={styles.notHere}>
                <span className={styles.glyph} data-role="none" aria-hidden />
                not here
              </span>
              <button
                type="button"
                className={styles.putOn}
                onClick={() => void run(api.addThreadAppearance(thread.id, n.id))}
              >
                It is, here
              </button>
            </div>
          );
        }
        return (
          <div key={n.id} className={styles.row}>
            <button type="button" className={styles.scene} onClick={() => onOpenScene(n.id)} title={name}>
              {name}
            </button>
            <span className={styles.roleCell}>
              <span className={styles.glyph} data-role={a.role} aria-hidden />
              <select
                aria-label={`What “${name}” does to the thread`}
                className={styles.role}
                data-role={a.role}
                value={a.role}
                title={roleHint(a.role)}
                onChange={(e) =>
                  void run(
                    api.updateThreadAppearance(thread.id, n.id, { role: e.target.value as ThreadRole }),
                  )
                }
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </span>
            <CommitTextarea
              className={styles.note}
              value={a.note}
              placeholder="What happens to it here?"
              aria-label={`Note on “${name}”`}
              onCommit={(note) => void run(api.updateThreadAppearance(thread.id, n.id, { note }))}
            />
            <button
              type="button"
              className={styles.remove}
              aria-label={`Take “${name}” off the thread`}
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
