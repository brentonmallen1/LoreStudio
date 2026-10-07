import type { AIJob } from "../../api/jobs";
import { jobOutcome } from "../../components/chronicle/timelineFormat";
import { serverTime } from "../serverDate";
import { sectionPath } from "../routes";

/**
 * Jobs (doc 21): what the header's list says about each piece of work, where its result
 * lives, and which jobs just finished. Pure, so the store and the list agree and the
 * tests can hold them to it.
 */

export const FINISHED_SHOWN = 10;

export function isActive(job: AIJob): boolean {
  return job.status === "queued" || job.status === "running";
}

/** Finished, not yet shown in the list, and worth a dot: a stop is the author's own doing. */
export function isUnseen(job: AIJob): boolean {
  return !isActive(job) && !job.seen_at && !job.quiet && job.status !== "cancelled";
}

/** Jobs that have finished since the last look: those running or queued then, and those new
 *  since (a local job can be queued and done between two looks). Nothing finished before the
 *  first look counts: the page loading is not news. */
export function finishedSince(
  wasActive: ReadonlySet<string>,
  known: ReadonlySet<string>,
  firstLookMs: number,
  jobs: AIJob[],
): AIJob[] {
  return jobs.filter(
    (j) =>
      !isActive(j) && (wasActive.has(j.id) || (!known.has(j.id) && serverTime(j.created_at) >= firstLookMs)),
  );
}

/** Where the author goes to see what a job made. Each kind says, or it has nowhere. */
export function jobOpen(job: AIJob): { to: string; label: string } | null {
  const id = job.story_id;
  if (!id || job.status !== "done") return null;
  switch (job.kind) {
    case "codex-suggest":
      return { to: `/stories/${id}/proposals`, label: "Review the proposals" };
    case "codex-sync":
      return { to: sectionPath(id, "lorebook", "connections"), label: "Open the graph" };
    case "numbers-backfill":
    case "numbers-reading":
    case "scene-summaries":
      return { to: `/stories/${id}/numbers`, label: "Open Numbers" };
    case "local-checks":
    case "check":
      return { to: `/stories/${id}/findings`, label: "Open findings" };
    case "editorial-pass":
      return { to: `${sectionPath(id, "chronicle", "activity")}?filter=analyses`, label: "Read the report" };
    default:
      return null;
  }
}

/** A job opened in the Chronicle: what it was asked, how it went, every call it made. */
export function jobDetailsPath(job: AIJob): string | null {
  return job.story_id ? `${sectionPath(job.story_id, "chronicle", "activity")}?item=job:${job.id}` : null;
}

/** A failure in plain words: the model not running is the common one and has a fix. */
export function plainError(error: string | null): string {
  const text = (error ?? "").trim();
  if (
    /connect(ion)? ?(error|refused)|all connection attempts failed|error reaching llm|name or service/i.test(
      text,
    )
  )
    return "The model is not running. Start Ollama, then Retry.";
  if (/interrupted by a restart/i.test(text)) return text.replace(/\.$/, "") + ".";
  return text.split("\n")[0] || "It failed without saying why.";
}

export function ordinal(n: number): string {
  const s =
    n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10];
  return `${n}${s ?? "th"}`;
}

/** "About 6 min left", only once two steps have shown how long a step takes. */
export function timeLeft(job: AIJob, nowMs: number): string | null {
  if (job.status !== "running" || !job.started_at || job.progress < 2 || job.total <= job.progress)
    return null;
  const perStep = (nowMs - serverTime(job.started_at)) / job.progress;
  if (perStep <= 0) return null;
  const minutes = Math.round((perStep * (job.total - job.progress)) / 60000);
  return minutes < 1 ? "under a minute left" : `about ${minutes} min left`;
}

/** The second line of a row: what it is doing, how far, or how it ended. */
export function jobLine(job: AIJob, nowMs: number): string {
  const progress = job.total > 0 ? `${job.progress} of ${job.total}` : "";
  switch (job.status) {
    case "running": {
      if (job.cancel_requested) return "Stopping after this step";
      const parts = [job.step_label || "Running", progress, timeLeft(job, nowMs)];
      return parts.filter(Boolean).join(" · ");
    }
    case "queued": {
      const place = job.queue_position ? `${ordinal(job.queue_position)} in line` : "";
      return [job.step_label || "Waiting", place].filter(Boolean).join(" · ");
    }
    case "done":
      return jobOutcome(job).sentence || "Finished";
    case "error":
      return plainError(job.error);
    default:
      return progress && job.progress < job.total ? `Stopped after ${progress}` : "Stopped";
  }
}

export function countLabel(n: number): string {
  return n === 1 ? "1 job running" : `${n} jobs running`;
}

/** The list's three parts: running, queued in lane order, and the last day's finished,
 *  unseen first, at most ten. */
export function arrange(jobs: AIJob[]): { running: AIJob[]; queued: AIJob[]; finished: AIJob[] } {
  const running = jobs.filter((j) => j.status === "running");
  const queued = jobs
    .filter((j) => j.status === "queued")
    .sort(
      (a, b) =>
        (a.lane ?? "").localeCompare(b.lane ?? "") || (a.queue_position ?? 0) - (b.queue_position ?? 0),
    );
  const finished = jobs
    .filter((j) => !isActive(j))
    .sort(
      (a, b) =>
        Number(isUnseen(b)) - Number(isUnseen(a)) ||
        serverTime(b.finished_at ?? b.created_at) - serverTime(a.finished_at ?? a.created_at),
    )
    .slice(0, FINISHED_SHOWN);
  return { running, queued, finished };
}

/** The tab title with the count in front, or as it was. */
export function titleWithCount(title: string, n: number): string {
  const bare = title.replace(/^\(\d+\) /, "");
  return n > 0 ? `(${n}) ${bare}` : bare;
}
