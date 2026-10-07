import type { AIJob } from "./jobs";
import { request } from "./request";

/** Settings › Automatic work (doc 22): what LoreStudio does by itself, when, and the switches. */
export interface AutomaticOption {
  key: string;
  label: string;
  kind: "number" | "switch";
  unit: string;
  min: number;
  max: number;
  value: number | boolean;
  default: number | boolean;
}

export interface AutomaticTask {
  id: string;
  label: string;
  description: string;
  /** schedule | visit (an open story asks for it) | start */
  when: "schedule" | "visit" | "start";
  enabled: boolean;
  /** "Every 24 hours, keeping the last 14", worded by the server from the options. */
  cadence: string;
  options: AutomaticOption[];
  last_run: { at: string; summary: string; ok: boolean } | null;
  next_at: string | null;
  /** The Settings section with the rest of its settings. */
  link: string | null;
  can_run_now: boolean;
}

export interface AutomaticWork {
  paused: boolean;
  /** Admins change these; anyone else reads them. */
  can_edit: boolean;
  tasks: AutomaticTask[];
}

export type AutomaticPatch = {
  paused?: boolean;
  tasks?: Record<string, Record<string, number | boolean>>;
};

/** The housekeeping jobs, for reloading the page when one finishes. */
export const AUTOMATIC_JOB_KINDS = [
  "auto-db-backup",
  "auto-prune-undo",
  "auto-prune-payloads",
  "auto-prune-jobs",
];

export const automaticApi = {
  get: () => request<AutomaticWork>("/automatic"),
  update: (patch: AutomaticPatch) =>
    request<AutomaticWork>("/automatic", { method: "PATCH", body: JSON.stringify(patch) }),
  runNow: (taskId: string) => request<AIJob>(`/automatic/${taskId}/run`, { method: "POST" }),
};
