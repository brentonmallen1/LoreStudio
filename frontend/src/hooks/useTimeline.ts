import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { TimelineEntry, TimelineQuery } from "../api/chronicle";
import { ACTIVE_JOB_STATUSES } from "../api/jobs";
import { MUTATION_EVENT } from "../api/request";

const PAGE = 50;
const BUSY_MS = 2000;
/** A job started elsewhere (another tab, the AI panel) still shows up without a reload. */
const IDLE_MS = 20000;

/**
 * Chronicle › Activity rows: refreshed every couple of seconds while a job on screen is
 * running, and now and then otherwise.
 *
 * "Load more" asks for a longer list from the top rather than the next page, so a
 * refresh while a job runs replaces the whole list and nothing is shown twice.
 */
export function useTimeline(query: Omit<TimelineQuery, "limit">) {
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const key = JSON.stringify(query);
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    // A new filter or search starts from the top.
    setLastKey(key);
    setLimit(PAGE);
    setEntries(null);
  }

  // Only the latest request may write: typing a search fires several.
  const seq = useRef(0);
  const load = useCallback(async (): Promise<TimelineEntry[]> => {
    const mine = ++seq.current;
    try {
      const res = await api.chronicleTimeline({ ...(JSON.parse(key) as TimelineQuery), limit });
      if (mine === seq.current) {
        setEntries(res.entries);
        setTotal(res.total);
      }
      return res.entries;
    } catch {
      if (mine === seq.current) setEntries((prev) => prev ?? []);
      return [];
    }
  }, [key, limit]);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      const rows = await load();
      if (!live) return;
      const busy = rows.some((e) => e.job && ACTIVE_JOB_STATUSES.includes(e.job.status));
      timer = setTimeout(tick, busy ? BUSY_MS : IDLE_MS);
    }
    const onMutation = () => {
      clearTimeout(timer);
      tick();
    };
    tick();
    window.addEventListener(MUTATION_EVENT, onMutation);
    return () => {
      live = false;
      clearTimeout(timer);
      window.removeEventListener(MUTATION_EVENT, onMutation);
    };
  }, [load]);

  const hasMore = entries !== null && entries.length < total;
  return { entries, total, hasMore, loadMore: () => setLimit((n) => n + PAGE), reload: load };
}
