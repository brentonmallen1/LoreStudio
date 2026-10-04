import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../../api/client";
import { nextSlot } from "../../lib/colorSlots";
import { usePromises } from "../../lib/promises/usePromises";
import { sectionPath } from "../../lib/routes";
import { refreshThreads } from "../../lib/story/refreshThreads";
import { useStoryStore } from "../../stores/storyStore";
import PageHeader from "../layout/PageHeader";
import type { Promises } from "../../types/promises";
import { useFindingsStore } from "../../stores/findingsStore";
import FindingRow from "../findings/FindingRow";
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
  // The checks are findings (doc 18 C7): the same rows, actions and dismissals as everywhere.
  const findings = useFindingsStore((s) => s.data?.findings);
  const loadFindings = useFindingsStore((s) => s.load);
  useEffect(() => {
    void loadFindings(storyId);
  }, [storyId, loadFindings, data]);
  const promiseFindings = (findings ?? []).filter((f) => PROMISE_CHECKS.has(f.check));

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
          order. <Link to="/guides/promises">New to this? A short guide, built on the demo story.</Link>
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
        {promiseFindings.length > 0 && (
          <section aria-label="Needs your eye" className={styles.checks}>
            <h2 className={styles.cardTitle}>Needs your eye</h2>
            {promiseFindings.map((f) => (
              <FindingRow key={f.id} finding={f} showWhere={false} />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

/** The findings the tapestry answers for: the promise checks and crossing threads. */
const PROMISE_CHECKS = new Set([
  "quiet_thread",
  "closes_before_opens",
  "clue_after_reveal",
  "reveal_without_clue",
  "misdirection_unanswered",
  "shared_reveal",
  "mice_nesting",
  "thin_try_fail",
  // Across the books of a series (v1.5).
  "series-left-open",
  "series-opens-again",
  "series-nesting",
]);

const empty = (d: Promises) => d.threads.length === 0 && d.twists.length === 0 && d.setups.length === 0;
