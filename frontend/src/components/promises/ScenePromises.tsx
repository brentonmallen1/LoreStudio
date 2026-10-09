import type { ReactNode } from "react";
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
import StillOpen from "../series/StillOpen";
import styles from "./ScenePromises.module.css";

/**
 * The scene's promises (doc 18 C6), on the Scene sheet's Promises page (doc 24 D19, canvas 8e).
 * On the left, what this scene does: a card per thread it touches, the thread's colour down
 * its edge, its role and a note, then the twists it holds. On the right, the context: what is
 * open coming in, what the reader knows by its end, then `aside` (the sheet's linked scenes).
 * Threads and twists are planned under Promises and attached here.
 */
export default function ScenePromises({
  storyId,
  nodeId,
  aside,
}: {
  storyId: string;
  nodeId: string;
  aside?: ReactNode;
}) {
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
  const knows = reader.learned > 0 || reader.clues > 0 || reader.only.length > 0;

  async function run(p: Promise<unknown>) {
    await p;
    await refreshThreads(storyId);
    await reload();
  }

  return (
    <div className={styles.bench}>
      <div className={styles.main}>
        <section aria-label="What this scene does" className={styles.block}>
          <h3 className={styles.heading}>What this scene does</h3>
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
                className={styles.card}
                style={{ "--lane": slotVar(t.color_slot) } as React.CSSProperties}
              >
                <div className={styles.cardHead}>
                  <Link to={sectionPath(storyId, "promises", "threads", t.id)} className={styles.name}>
                    {t.name}
                  </Link>
                  <select
                    aria-label={`What this scene does to ${t.name}`}
                    className={styles.role}
                    value={beat.role}
                    title={roleHint(beat.role)}
                    onChange={(e) =>
                      void run(
                        api.updateThreadAppearance(t.id, nodeId, { role: e.target.value as ThreadRole }),
                      )
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
                    <X size={13} aria-hidden />
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
              <Plus size={13} aria-hidden />
              <select
                aria-label="Attach a thread to this scene"
                value=""
                onChange={(e) => e.target.value && void run(api.addThreadAppearance(e.target.value, nodeId))}
              >
                <option value="">Attach a thread this scene opens, moves or closes</option>
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
          <h3 className={styles.heading}>Twists here</h3>
          {twistsHere.map((tw) => {
            const clues = tw.clues.filter((c) => c.index === index).length;
            return (
              <div
                key={tw.id}
                className={styles.card}
                style={{ "--lane": slotVar(tw.color_slot) } as React.CSSProperties}
              >
                <div className={styles.cardHead}>
                  <span className={`${styles.dot} ${styles.diamond}`} aria-hidden />
                  <Link to={sectionPath(storyId, "promises", "twists", tw.id)} className={styles.name}>
                    {tw.name}
                  </Link>
                  <span className={styles.sub}>
                    {[
                      tw.reveal_index === index ? "revealed here" : "",
                      clues ? `${clues} ${clues === 1 ? "clue" : "clues"} in this scene` : "",
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
      </div>

      <div className={styles.side}>
        {open.length > 0 && (
          <section aria-label="Open coming in" className={styles.block}>
            <h3 className={styles.heading}>Open coming in</h3>
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

        <StillOpen storyId={storyId} nodeId={nodeId} data={data} onChanged={reload} />

        {knows && (
          <section aria-label="The reader, by the end" className={styles.block}>
            <h3 className={styles.heading}>The reader, by the end</h3>
            <div className={styles.fact}>
              <span className={styles.key}>{reader.learned}</span>
              <span>
                {reader.learned === 1 ? "thing" : "things"} known · {reader.clues}{" "}
                {reader.clues === 1 ? "clue" : "clues"} seen
              </span>
            </div>
            {reader.overturned.length > 0 && (
              <div className={styles.fact}>
                <span className={styles.key} aria-hidden>
                  ✕
                </span>
                <span>no longer believes “{reader.overturned[reader.overturned.length - 1]}”</span>
              </div>
            )}
            {reader.only.length > 0 && (
              <div className={styles.fact}>
                <span className={styles.key} aria-hidden>
                  ◐
                </span>
                <span>only the reader knows: {reader.only[reader.only.length - 1]}</span>
              </div>
            )}
            <Link to={sectionPath(storyId, "promises", "reader")} className={styles.link}>
              What the reader knows, scene by scene
            </Link>
          </section>
        )}

        {aside}

        <p className={styles.foot}>
          <Link to="/guides/promises" className={styles.link}>
            How promises work
          </Link>
          {" · "}
          <Link to={sectionPath(storyId, "promises", "tapestry")} className={styles.link}>
            The tapestry →
          </Link>
        </p>
      </div>
    </div>
  );
}
