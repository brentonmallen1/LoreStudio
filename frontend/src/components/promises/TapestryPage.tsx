import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../../api/client";
import { nextSlot } from "../../lib/colorSlots";
import { usePromises } from "../../lib/promises/usePromises";
import { sectionPath } from "../../lib/routes";
import { refreshThreads } from "../../lib/story/refreshThreads";
import { useStoryStore } from "../../stores/storyStore";
import PageHeader from "../layout/PageHeader";
import type { PromiseCheck, Promises } from "../../types/promises";
import Tapestry from "./Tapestry";
import styles from "./Promises.module.css";

/**
 * The tapestry (doc 18 C4): the home of Promises. Every thread, twist and setup across the
 * book in reading order, and what may need the author's eye, each with the way to it.
 */
export default function TapestryPage({ storyId }: { storyId: string }) {
  const navigate = useNavigate();
  const threads = useStoryStore((s) => s.threads);
  const { data } = usePromises(storyId);

  async function newThread() {
    const t = await api.createThread(storyId, {
      name: "New thread",
      color_slot: nextSlot(threads.map((x) => x.color_slot)),
    });
    await refreshThreads(storyId);
    navigate(sectionPath(storyId, "promises", "threads", t.id));
  }

  async function newTwist() {
    const t = await api.createTwist(storyId, { name: "New twist" });
    navigate(sectionPath(storyId, "promises", "twists", t.id));
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Promises"
        summary={
          data
            ? `${data.threads.length} threads · ${data.twists.length} twists · ${data.setups.length} setups`
            : undefined
        }
        primary={{ label: "New thread", icon: Plus, onClick: () => void newThread() }}
        more={[{ label: "New twist", icon: Plus, onSelect: () => void newTwist() }]}
      />
      <div className={styles.body}>
        <p className={styles.intro}>
          Every story makes promises to the reader and pays them off. A <strong>thread</strong> is a question
          it opens and later answers. A <strong>twist</strong> hides a truth behind what the reader is led to
          believe. A <strong>setup</strong> plants something a later scene pays off. Here they are, in reading
          order.
        </p>
        {data === null ? null : empty(data) ? (
          <section className={styles.card} aria-label="No promises yet">
            <p className={styles.quiet}>
              Nothing to draw yet. Start with a thread: the question your story asks, the one the reader turns
              pages to have answered. Put it in the scene that raises it and the one that answers it, and it
              appears here.
            </p>
            <div className={styles.form}>
              <button type="button" className={styles.primaryBtn} onClick={() => void newThread()}>
                Add the first thread
              </button>
            </div>
          </section>
        ) : (
          <Tapestry storyId={storyId} data={data} />
        )}
        {data && data.checks.length > 0 && (
          <section aria-label="Needs your eye" className={styles.checks}>
            <h2 className={styles.cardTitle}>Needs your eye</h2>
            <div className={styles.checkGrid}>
              {data.checks.map((c, i) => {
                const go = checkAction(c, data);
                return (
                  <div key={`${c.check}-${i}`} className={styles.card}>
                    <span className={styles.rowTitle}>{c.text}</span>
                    {c.suggestion && <span className={styles.rowNote}>{c.suggestion}</span>}
                    {go && (
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => navigate(go.to(storyId))}
                      >
                        {go.label}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const empty = (d: Promises) => d.threads.length === 0 && d.twists.length === 0 && d.setups.length === 0;

/** Where a check sends the author: the scene it names, else the sheet. */
function checkAction(
  c: PromiseCheck,
  d: Promises,
): { label: string; to: (storyId: string) => string } | null {
  if (c.node_id) {
    const title = d.scenes.find((s) => s.id === c.node_id)?.title ?? "the scene";
    return { label: `Open ${title}`, to: (sid) => `/stories/${sid}/write/${c.node_id}` };
  }
  if (c.thread_id)
    return { label: "Open the thread", to: (sid) => sectionPath(sid, "promises", "threads", c.thread_id!) };
  if (c.twist_id)
    return { label: "Open the twist", to: (sid) => sectionPath(sid, "promises", "twists", c.twist_id!) };
  return null;
}
