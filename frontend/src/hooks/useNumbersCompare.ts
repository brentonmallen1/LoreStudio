import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { numbersApi } from "../api/numbers";
import { useJobs } from "./useJobs";
import { defaultFrom } from "../lib/numbers/readings";
import type { Reading, ReadingSummary } from "../types/numbers";

const KEY = (storyId: string) => `ls_numbers_compare:${storyId}`;
const BACKFILL = "numbers-backfill";

function remembered(storyId: string): string | null {
  try {
    return localStorage.getItem(KEY(storyId));
  } catch {
    return null;
  }
}

function remember(storyId: string, value: string | null) {
  try {
    if (value) localStorage.setItem(KEY(storyId), value);
    else localStorage.removeItem(KEY(storyId));
  } catch {
    // A private window: the choice lasts as long as the URL does.
  }
}

/**
 * The Numbers page's comparison (doc 19 P4): which reading to compare from, and to (now when
 * null). The choice is in the URL (`?compare=<from>` or `<from>..<to>`) and remembered per
 * story. Earlier versions with no reading are measured on the job queue the first time the
 * page sees them; the list reloads when that job, or a Measure now, has finished.
 */
export function useNumbersCompare(storyId: string) {
  const [params, setParams] = useSearchParams();
  const [readings, setReadings] = useState<ReadingSummary[]>([]);
  const [unmeasured, setUnmeasured] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, Reading>>({});
  // When the list was read: "now" for the bar's "5 days earlier" and the trend row's end.
  const [clock, setClock] = useState(0);
  const { active } = useJobs(storyId);
  const backfillJob = active.find((j) => j.kind === BACKFILL);
  const startedBackfill = useRef(false);

  const reload = useCallback(
    () =>
      numbersApi
        .readings(storyId)
        .then((r) => {
          setReadings(r.readings);
          setUnmeasured(r.unmeasured_versions);
          setClock(Date.now());
          return r;
        })
        .catch(() => null),
    [storyId],
  );

  useEffect(() => {
    void reload().then((r) => {
      if (r && r.unmeasured_versions > 0 && !startedBackfill.current) {
        startedBackfill.current = true;
        void numbersApi.backfill(storyId).catch(() => undefined);
      }
    });
  }, [reload, storyId]);

  // The backfill ends: its readings are there to pick.
  const wasBackfilling = useRef(false);
  useEffect(() => {
    if (wasBackfilling.current && !backfillJob) void reload();
    wasBackfilling.current = !!backfillJob;
  }, [backfillJob, reload]);

  // The URL wins; with none, the story's remembered comparison comes back, once per story.
  const param = params.get("compare");
  const restored = useRef<string | null>(null);
  useEffect(() => {
    if (restored.current === storyId) return;
    restored.current = storyId;
    const back = param === null ? remembered(storyId) : null;
    if (back)
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          next.set("compare", back);
          return next;
        },
        { replace: true },
      );
  }, [param, setParams, storyId]);

  // "?compare=start" (the palette's command): the default, once the readings are in.
  useEffect(() => {
    if (param !== "start" || readings.length === 0) return;
    const from = defaultFrom(readings);
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (from) next.set("compare", from.id);
        else next.delete("compare");
        return next;
      },
      { replace: true },
    );
  }, [param, readings, setParams]);

  const [fromId, toId] = useMemo(() => {
    const [a, b] = (param ?? "").split("..");
    const known = (id: string | undefined) => (id && readings.some((r) => r.id === id) ? id : null);
    return [known(a), known(b)];
  }, [param, readings]);

  useEffect(() => {
    for (const id of [fromId, toId]) {
      if (id && !loaded[id])
        void numbersApi
          .reading(storyId, id)
          .then((r) => setLoaded((m) => ({ ...m, [id]: r })))
          .catch(() => undefined);
    }
  }, [fromId, toId, loaded, storyId]);

  const choose = useCallback(
    (from: string | null, to: string | null = null) => {
      const value = from ? (to ? `${from}..${to}` : from) : null;
      remember(storyId, value);
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          if (value) next.set("compare", value);
          else next.delete("compare");
          return next;
        },
        { replace: true },
      );
    },
    [setParams, storyId],
  );

  const measureNow = useCallback(async () => {
    await numbersApi.measure(storyId);
    // Taken on the server just after it answered: look again shortly.
    window.setTimeout(() => void reload(), 1500);
  }, [reload, storyId]);

  return {
    clock,
    readings,
    unmeasured,
    backfillJob,
    fromId,
    toId,
    from: fromId ? (loaded[fromId] ?? null) : null,
    to: toId ? (loaded[toId] ?? null) : null,
    /** Compare from `from` to `to` (now when null); null turns comparing off. */
    choose,
    /** Turn comparing on from the default (D4): the latest version, else the previous reading. */
    start: () => choose(defaultFrom(readings)?.id ?? null),
    measureNow,
    reload,
  };
}

export type NumbersCompare = ReturnType<typeof useNumbersCompare>;
