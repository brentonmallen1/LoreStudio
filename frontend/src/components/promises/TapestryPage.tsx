import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../../api/client";
import { nextSlot } from "../../lib/colorSlots";
import { usePromises } from "../../lib/promises/usePromises";
import { sectionPath } from "../../lib/routes";
import { refreshThreads } from "../../lib/story/refreshThreads";
import { useStoryStore } from "../../stores/storyStore";
import PageHeader from "../layout/PageHeader";
import ThreadVisualization from "../threads/ThreadVisualization";
import styles from "./Promises.module.css";

/**
 * The tapestry (doc 18 C3/C4): the home of Promises. Every thread, twist and setup across the
 * book in reading order, and what may need the author's eye.
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
        <ThreadVisualization storyId={storyId} />
        {data && data.checks.length > 0 && (
          <section className={styles.card} aria-label="Needs your eye">
            <h2 className={styles.cardTitle}>Needs your eye</h2>
            <div className={styles.list}>
              {data.checks.map((c, i) => (
                <div key={`${c.check}-${i}`} className={styles.row}>
                  <div className={styles.rowMain}>
                    <span className={styles.rowTitle}>{c.text}</span>
                    {c.suggestion && <span className={styles.rowNote}>{c.suggestion}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
