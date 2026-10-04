import { Link } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { api } from "../../api/client";
import { slotVar } from "../../lib/colorSlots";
import { usePromises } from "../../lib/promises/usePromises";
import { openAt, readerBy } from "../../lib/promises/sceneView";
import { sectionPath } from "../../lib/routes";
import { refreshThreads } from "../../lib/story/refreshThreads";
import { ROLES, roleHint } from "../../lib/threads/roles";
import type { ThreadRole } from "../../types";
import CommitTextarea from "../common/CommitTextarea";
import styles from "./ScenePromises.module.css";

/**
 * The scene workbench (doc 18 C6), in the This scene tab: the threads open at this point, what
 * this scene does to each thread it touches, the twists it holds, and what the reader knows by
 * its end. Threads and twists are planned under Promises and attached here; the scene's links
 * (setups and payoffs) follow in the same fold.
 */
export default function ScenePromises({ storyId, nodeId }: { storyId: string; nodeId: string }) {
  const { data, reload } = usePromises(storyId);
  if (!data) return null;
  const scene = data.scenes.find((s) => s.id === nodeId);
  if (!scene) return <p className={styles.quiet}>Promises are made in scenes; this is not one.</p>;
  const index = scene.index;
  const open = openAt(data, index);
  const here = data.threads.filter((t) => t.beats.some((b) => b.index === index));
  const others = data.threads.filter((t) => !here.includes(t));
  const twistsHere = data.twists.filter(
    (tw) => tw.reveal_index === index || tw.clues.some((c) => c.index === index),
  );
  const reader = readerBy(data, index);

  async function run(p: Promise<unknown>) {
    await p;
    await refreshThreads(storyId);
    await reload();
  }

  return (
    <div className={styles.bench}>
      <div className={styles.top}>
        <Link to={sectionPath(storyId, "promises", "tapestry")} className={styles.link}>
          See them all on the tapestry
        </Link>
      </div>

      {open.length > 0 && (
        <section aria-label="Open at this point" className={styles.block}>
          <h4 className={styles.heading}>Open at this point</h4>
          {open.map(({ thread, line }) => (
            <div
              key={thread.id}
              className={styles.item}
              style={{ "--lane": slotVar(thread.color_slot) } as React.CSSProperties}
            >
              <span className={styles.dot} aria-hidden />
              <div className={styles.itemBody}>
                <Link to={sectionPath(storyId, "promises", "threads", thread.id)} className={styles.name}>
                  {thread.name}
                </Link>
                <span className={styles.sub}>{line}</span>
              </div>
            </div>
          ))}
        </section>
      )}

      <section aria-label="What this scene does" className={styles.block}>
        <h4 className={styles.heading}>What this scene does</h4>
        {here.length === 0 && (
          <p className={styles.quiet}>
            {data.threads.length
              ? "No thread here yet. Attach the ones this scene opens, moves on or closes."
              : "No threads yet. A thread is a question the story opens and later answers."}
          </p>
        )}
        {here.map((t) => {
          const beat = t.beats.find((b) => b.index === index)!;
          return (
            <div
              key={t.id}
              className={styles.does}
              style={{ "--lane": slotVar(t.color_slot) } as React.CSSProperties}
            >
              <div className={styles.doesHead}>
                <span className={styles.dot} aria-hidden />
                <Link to={sectionPath(storyId, "promises", "threads", t.id)} className={styles.name}>
                  {t.name}
                </Link>
                <select
                  aria-label={`What this scene does to ${t.name}`}
                  className={styles.role}
                  value={beat.role}
                  title={roleHint(beat.role)}
                  onChange={(e) =>
                    void run(api.updateThreadAppearance(t.id, nodeId, { role: e.target.value as ThreadRole }))
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Take ${t.name} off this scene`}
                  title="Take this thread off the scene"
                  onClick={() => void run(api.removeThreadAppearance(t.id, nodeId))}
                >
                  <X size={12} aria-hidden />
                </button>
              </div>
              <CommitTextarea
                className={styles.note}
                value={beat.note}
                placeholder="What happens to it here?"
                aria-label={`Note on ${t.name} here`}
                onCommit={(note) => void run(api.updateThreadAppearance(t.id, nodeId, { note }))}
              />
            </div>
          );
        })}
        {others.length > 0 && (
          <label className={styles.attach}>
            <Plus size={12} aria-hidden />
            <select
              aria-label="Attach a thread to this scene"
              value=""
              onChange={(e) => e.target.value && void run(api.addThreadAppearance(e.target.value, nodeId))}
            >
              <option value="">Attach a thread</option>
              {others.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      <section aria-label="Twists here" className={styles.block}>
        <h4 className={styles.heading}>Twists here</h4>
        {twistsHere.map((tw) => {
          const clues = tw.clues.filter((c) => c.index === index).length;
          return (
            <div
              key={tw.id}
              className={styles.item}
              style={{ "--lane": slotVar(tw.color_slot) } as React.CSSProperties}
            >
              <span className={`${styles.dot} ${styles.diamond}`} aria-hidden />
              <div className={styles.itemBody}>
                <Link to={sectionPath(storyId, "promises", "twists", tw.id)} className={styles.name}>
                  {tw.name}
                </Link>
                <span className={styles.sub}>
                  {[
                    tw.reveal_index === index ? "revealed here" : "",
                    clues ? `${clues} ${clues === 1 ? "clue" : "clues"} here` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            </div>
          );
        })}
        <p className={styles.quiet}>
          Select words in the scene to plant a clue there, or to mark where a twist is revealed.
        </p>
      </section>

      {(reader.learned > 0 || reader.clues > 0 || reader.only.length > 0) && (
        <section aria-label="The reader by now" className={styles.block}>
          <h4 className={styles.heading}>The reader, by the end of this scene</h4>
          <p className={styles.sub}>
            Knows {reader.learned} {reader.learned === 1 ? "thing" : "things"} and has seen {reader.clues}{" "}
            {reader.clues === 1 ? "clue" : "clues"}
            {reader.overturned.length
              ? `; no longer believes ${reader.overturned.length === 1 ? "that" : "what"} “${reader.overturned[reader.overturned.length - 1]}”`
              : ""}
            .
          </p>
          {reader.only.length > 0 && (
            <p className={styles.sub}>Only the reader knows: {reader.only[reader.only.length - 1]}</p>
          )}
          <Link to={sectionPath(storyId, "promises", "reader")} className={styles.link}>
            What the reader knows, scene by scene
          </Link>
        </section>
      )}
    </div>
  );
}
