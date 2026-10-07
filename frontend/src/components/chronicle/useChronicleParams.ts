import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import type { TimelineFilter } from "../../api/chronicle";

/** What is open in the detail panel: `job:<id>`, `log:<id>` or `session:<id>`. */
export type ChronicleItem = { kind: "job" | "log" | "session"; id: string };

type Key = "item" | "filter" | "q" | "feature";

const FILTERS: TimelineFilter[] = ["all", "running", "problems", "results", "analyses", "starred"];

export function itemParam(kind: ChronicleItem["kind"], id: string): string {
  return `${kind}:${id}`;
}

function parseItem(raw: string | null): ChronicleItem | null {
  const [kind, id] = (raw ?? "").split(":");
  return (kind === "job" || kind === "log" || kind === "session") && id ? { kind, id } : null;
}

/**
 * The Chronicle's state lives in the URL: which row is open, the filter and
 * the search. It used to be component state, so Back left the page instead of closing
 * a conversation, and nothing could link to a job.
 */
export function useChronicleParams() {
  const [params, setParams] = useSearchParams();
  const rawFilter = params.get("filter") as TimelineFilter | null;

  const update = useCallback(
    (next: Partial<Record<Key, string | null>>, opts: { replace?: boolean } = {}) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(next)) {
            if (!v || (k === "filter" && v === "all")) p.delete(k);
            else p.set(k, v);
          }
          return p;
        },
        { replace: opts.replace },
      );
    },
    [setParams],
  );

  return {
    item: parseItem(params.get("item")),
    filter: rawFilter && FILTERS.includes(rawFilter) ? rawFilter : ("all" as TimelineFilter),
    q: params.get("q") ?? "",
    feature: params.get("feature") ?? "",
    update,
  };
}
