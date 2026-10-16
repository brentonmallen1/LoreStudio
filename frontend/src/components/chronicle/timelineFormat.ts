import type { AIJob } from "../../api/jobs";
import { aiFeatureLabel } from "../../lib/ai/features.generated";
import { parseServerDate, serverTime } from "../../lib/serverDate";
import type { ActivityLog } from "../../types";

/**
 * Words for Chronicle › Activity. Everything here is pure, so the tests can hold the copy.
 */

// ── Days ───────────────────────────────────────────────────────────────

/** The calendar day in the reader's zone, as a number that subtracts cleanly. */
function dayNumber(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
}

/** "Today", "Yesterday", "Wednesday 24 September", with the year once it is not this one. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = parseServerDate(iso);
  const days = dayNumber(now) - dayNumber(d);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** Consecutive runs of rows on the same day, in the order given. */
export function groupByDay<T extends { at: string }>(rows: T[], now: Date = new Date()): [string, T[]][] {
  const groups: [string, T[]][] = [];
  for (const row of rows) {
    const label = dayLabel(row.at, now);
    const last = groups[groups.length - 1];
    if (last && last[0] === label) last[1].push(row);
    else groups.push([label, [row]]);
  }
  return groups;
}

/** "14:02" in the reader's own clock. */
export function clockTime(iso: string): string {
  return parseServerDate(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// ── Activity rows ──────────────────────────────────────────────────────

/** Names for the checks made on this machine, which are not Assistant features. */
const LOCAL_LABELS: Record<string, string> = {
  "prose-analysis": "Prose check",
  "editorial-consistency": "Tense and point of view",
  "entity-suggestions": "Name scan",
  "scene-summary-batch": "Scene summaries",
};

/** What to call a check or an Assistant feature: its own name, never its id. */
export function featureLabel(id: string): string {
  return LOCAL_LABELS[id] ?? aiFeatureLabel(id);
}

/** Older rows carry no feature: name them by what kind of row they are. */
const EVENT_LABELS: Record<string, string> = {
  analysis_run: "A check",
  editorial_pass: "Editorial pass",
};

/** The feature's name from the backend table; older rows fall back to the event type. */
export function logTitle(log: ActivityLog): string {
  const feature = log.metadata_?.feature as string | undefined;
  if (feature) return featureLabel(feature);
  if (EVENT_LABELS[log.event_type]) return EVENT_LABELS[log.event_type];
  if (log.event_type.startsWith("ai_")) return aiFeatureLabel(log.event_type.slice(3).replace(/_/g, "-"));
  return "Something LoreStudio did";
}

/**
 * One line of text for a preview. Prompts about a scene carry its HTML, and the old list
 * showed `<p>The knock came…</p>` verbatim.
 */
export function plainText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const mins = Math.floor(s / 60);
  return `${mins}m ${Math.round(s - mins * 60)}s`;
}

/** Status words for a call, or null when it went fine and needs no announcement. */
export function callProblem(log: ActivityLog): string | null {
  const status = log.metadata_?.status as string | undefined;
  if (!status || status === "ok") return null;
  return (
    (
      {
        error: "Failed",
        cancelled: "Stopped",
        // The model would not keep to the answer's form, so it answered without one.
        "schema-fallback": "Loose answer",
        "invalid-json": "Unreadable answer",
        "schema-invalid": "Answer didn't fit",
      } as Record<string, string>
    )[status] ?? "Something went wrong"
  );
}

/**
 * What to call one of a job's calls. Scene passes send "Scene: <title>" first, so name the
 * scene; otherwise the feature, since a prompt like "Index this scene." says nothing.
 */
export function callLabel(log: ActivityLog): string {
  const prompt = typeof log.metadata_?.prompt === "string" ? log.metadata_.prompt : "";
  const scene = prompt.match(/^Scene: ([^\n]+)\n/);
  return scene ? scene[1].trim() : logTitle(log);
}

// ── Jobs ───────────────────────────────────────────────────────────────

export const JOB_STATUS_TEXT: Record<string, string> = {
  queued: "Waiting",
  running: "Running",
  done: "Finished",
  error: "Failed",
  cancelled: "Stopped",
};

/**
 * Every kind of job, by name. A job carries the label it was queued with ("Pacing check",
 * "Measuring the book"); this names one whose label is missing, and the older jobs whose label
 * said "Codex", a word the writer no longer meets outside Settings (doc 30 D7).
 */
export const JOB_KIND_LABELS: Record<string, string> = {
  "local-checks": "Checking the prose",
  "codex-sync": "Building Connections",
  "codex-suggest": "Who's here and what's established",
  "codex-index": "Indexing for the Assistant",
  check: "A check",
  "numbers-reading": "Measuring the book",
  "numbers-backfill": "Measuring earlier versions",
  "scene-summaries": "Scene summaries",
  "editorial-pass": "Editorial pass",
  "import-enrich": "Reading an import",
  "auto-db-backup": "Backing up everything",
  "auto-update-check": "Checking for a new LoreStudio",
  "auto-prune-undo": "Trimming the undo history",
  "auto-prune-payloads": "Deleting old AI call records",
  "auto-prune-jobs": "Forgetting old automatic jobs",
};

/** What to call a job: its label, or its kind's name, never a raw key. */
export function jobName(job: Pick<AIJob, "kind" | "label">): string {
  const label = (job.label ?? "").trim();
  const kind = JOB_KIND_LABELS[job.kind];
  if (/^Codex\b/.test(label) && kind) {
    const rest = label.split(": ").slice(1).join(": ");
    return rest ? `${kind}: ${rest}` : kind;
  }
  return label || kind || "Background work";
}

export function isActiveJob(job: AIJob): boolean {
  return job.status === "queued" || job.status === "running";
}

export function jobDuration(job: AIJob): string | null {
  if (!job.started_at || !job.finished_at) return null;
  return formatDuration(serverTime(job.finished_at) - serverTime(job.started_at));
}

function n(result: Record<string, unknown>, key: string): number {
  const v = result[key];
  return typeof v === "number" ? v : 0;
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Graph counts the Codex sync reports, in the author's words. */
const GRAPH_WORDS: Record<string, string> = {
  character: "characters",
  scene: "scenes",
  location: "places",
  thread: "threads",
  twist: "twists",
  fact: "facts",
  rel: "relationships",
  at: "scenes set somewhere",
  links: "scene links",
  advances: "thread advances",
  revealed_in: "reveals",
  clue_in: "clues",
  follows: "scene orders",
  speaks_in: "speaking parts",
  present_in: "appearances",
};

/**
 * What a finished job did, as a sentence, and the rest as labelled counts.
 *
 * The old list printed the result dict: `nodes: 34 · edges: 78 · rel: 5 · at: 3`.
 */
export function jobOutcome(job: AIJob): { sentence: string; details: [string, string][] } {
  // A job that failed or has not finished has no result, and "Read 0 scenes" would be a
  // claim about work that never happened.
  if (!job.result) return { sentence: "", details: [] };
  const r = job.result;
  switch (job.kind) {
    case "scene-summaries": {
      const done = n(r, "summarized_count");
      const skipped = n(r, "skipped_count");
      const failed = n(r, "failed_count");
      const parts = [`Summarized ${plural(done, "scene")}`];
      if (skipped) parts.push(`${skipped} skipped (empty or already current)`);
      if (failed) parts.push(`${failed} failed`);
      return { sentence: `${parts.join("; ")}.`, details: [] };
    }
    case "codex-sync": {
      const details = Object.entries(r)
        .filter(([k, v]) => k !== "nodes" && k !== "edges" && typeof v === "number" && v > 0)
        .map(([k, v]) => [GRAPH_WORDS[k] ?? k.replace(/_/g, " "), String(v)] as [string, string]);
      return {
        sentence: `Built the graph: ${plural(n(r, "nodes"), "thing")} and ${plural(n(r, "edges"), "connection")}.`,
        details,
      };
    }
    case "codex-suggest": {
      const proposed = n(r, "presence") + n(r, "facts");
      return {
        sentence: `Read ${plural(n(r, "scenes"), "scene")} and proposed ${plural(proposed, "entry", "entries")} for you to review.`,
        details: [
          ["who is here", String(n(r, "presence"))],
          ["facts", String(n(r, "facts"))],
          ...(n(r, "skipped") ? [["scenes skipped", String(n(r, "skipped"))] as [string, string]] : []),
        ],
      };
    }
    case "codex-index": {
      const model = typeof r.model === "string" ? ` with ${r.model}` : "";
      return {
        sentence: `Indexed ${plural(n(r, "chunks"), "passage")}; embedded ${n(r, "embedded")}${model}.`,
        details: [
          ["unchanged, kept", String(n(r, "reused"))],
          ["removed", String(n(r, "removed"))],
        ].filter(([, v]) => v !== "0") as [string, string][],
      };
    }
    case "check":
    case "editorial-pass": {
      // The run's own line ("Pacing analysis: 3 slow spot(s) identified").
      const summary = typeof r.summary === "string" ? r.summary : "";
      return { sentence: summary ? `${summary.replace(/\.$/, "")}.` : "", details: [] };
    }
    case "local-checks":
      return { sentence: `Checked every scene; ${plural(n(r, "open"), "finding")} open.`, details: [] };
    case "numbers-reading":
      return {
        sentence: r.taken === false ? "Nothing had changed since the last reading." : "Measured the book.",
        details: [],
      };
    case "numbers-backfill":
      return { sentence: `Measured ${plural(n(r, "measured"), "earlier version")}.`, details: [] };
    default:
      return {
        // Automatic work's housekeeping says what it did in a sentence (doc 22).
        sentence: typeof r.summary === "string" ? `${r.summary.replace(/\.$/, "")}.` : "",
        details: Object.entries(r)
          .filter(([, v]) => typeof v === "number" || typeof v === "string")
          .map(([k, v]) => [k.replace(/_/g, " "), String(v)]),
      };
  }
}

/** Why a job may have no calls to show. Deterministic jobs never make any. */
export function noCallsNote(job: AIJob): string {
  if (job.kind === "codex-sync") {
    return "This job made no AI calls. The graph is built from what you have written; nothing was sent to a model.";
  }
  if (job.kind === "codex-index") {
    return "Embedding requests are not recorded as calls. The counts above are what it did.";
  }
  if (isActiveJob(job)) return "No calls yet.";
  return "No AI calls are linked to this job. Jobs that ran before 26 September 2026 did not record theirs.";
}

/** What the job was asked to do, where the parameters say more than the label. */
export function jobParams(job: AIJob): [string, string][] {
  const words: Record<string, string> = {
    force_refresh: "Redo summaries that are current",
    up_to_node_id: "Stop at a scene",
    node_ids: "Only these scenes",
    embed_model: "Embedding model",
  };
  return Object.entries(job.params ?? {})
    .filter(([, v]) => v !== null && v !== undefined && v !== false && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => [
      words[k] ?? k.replace(/_/g, " "),
      v === true ? "yes" : Array.isArray(v) ? plural(v.length, "scene") : String(v),
    ]);
}
