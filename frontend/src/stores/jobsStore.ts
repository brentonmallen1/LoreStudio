import { create } from "zustand";
import { jobsApi, type AIJob } from "../api/jobs";
import { MUTATION_EVENT } from "../api/request";
import { finishedSince, isActive, isUnseen, jobDetailsPath, jobOpen } from "../lib/jobs/jobs";
import { getAIAvailable } from "../lib/mode";
import { navigateTo } from "../lib/navigation";
import { useToastStore } from "./toastStore";

/** While work is running, look often enough to feel live; otherwise leave the server alone. */
const BUSY_MS = 2000;
const IDLE_MS = 20000;
/** The list keeps the last day's finished jobs. */
const SINCE_HOURS = 24;
const TITLE_KEY = "ls_jobs_in_title";

/** Fired once per job when it finishes, for pages that show its result. */
export const JOB_FINISHED_EVENT = "ls:job-finished";

function readTitlePref(): boolean {
  try {
    return localStorage.getItem(TITLE_KEY) === "on";
  } catch {
    return false;
  }
}

interface JobsState {
  jobs: AIJob[];
  loaded: boolean;
  /** The header's list is open. */
  open: boolean;
  /** Finished jobs that were unseen when the list opened: "While you were away". */
  away: string[];
  /** D13: the running count in the browser tab's title. Off by default; per device. */
  inTitle: boolean;
  setOpen: (open: boolean) => void;
  setInTitle: (on: boolean) => void;
  refresh: () => Promise<AIJob[]>;
  cancel: (id: string) => Promise<void>;
  runNext: (id: string) => Promise<void>;
  retry: (id: string) => Promise<void>;
  markSeen: (ids: string[]) => Promise<void>;
  /** Start polling while something needs the list; returns the matching stop. */
  watch: () => () => void;
}

let watchers = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
/** Ids running or queued at the last look: the ones whose finishing is news. */
let wasActive = new Set<string>();
/** Every id in the last look, and when the first look was. */
let known = new Set<string>();
let firstLookMs = 0;

/** When this window first read the list: what finished before it happened while the author was away. */
export function jobsFirstLook(): number {
  return firstLookMs;
}

/** "Pacing check finished · 4 slow spots", with Open; a failure with Details. No toast for a
 *  stop (the author did it), a quiet job, or a job whose page the author is on. */
function announce(job: AIJob) {
  if (job.quiet || job.status === "cancelled") return;
  const open = jobOpen(job);
  if (open && window.location.pathname === open.to.split("?")[0]) return;
  const show = useToastStore.getState().show;
  if (job.status === "error") {
    const details = jobDetailsPath(job);
    show(
      `${job.label} failed`,
      "error",
      8000,
      details ? { label: "Details", run: () => navigateTo(details) } : undefined,
    );
    return;
  }
  const details = jobDetailsPath(job);
  const go = open ?? (details ? { to: details, label: "Open" } : null);
  show(
    `${job.label} finished`,
    "success",
    6000,
    go ? { label: "Open", run: () => navigateTo(go.to) } : undefined,
  );
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  loaded: false,
  open: false,
  away: [],
  inTitle: readTitlePref(),

  // Opening the list is seeing what finished, in every window.
  setOpen: (open) => {
    const away = open
      ? get()
          .jobs.filter(isUnseen)
          .map((j) => j.id)
      : [];
    set({ open, away });
    void get().markSeen(away);
  },

  setInTitle: (inTitle) => {
    try {
      localStorage.setItem(TITLE_KEY, inTitle ? "on" : "off");
    } catch {
      // Private window: the choice lasts this session.
    }
    set({ inTitle });
  },

  refresh: async () => {
    let list: AIJob[];
    try {
      // Writer mode asks for local work only: it never sees that a model job exists (D6).
      list = await jobsApi.list({ sinceHours: SINCE_HOURS, lane: getAIAvailable() ? undefined : "local" });
    } catch {
      return get().jobs; // a list that cannot load must not break the page it sits in
    }
    if (!get().loaded) firstLookMs = Date.now() - 5000; // allow the server's clock a little slack
    const done = get().loaded ? finishedSince(wasActive, known, firstLookMs, list) : [];
    wasActive = new Set(list.filter(isActive).map((j) => j.id));
    known = new Set(list.map((j) => j.id));
    set({ jobs: list, loaded: true });
    // What finishes while the list is open is seen as it happens.
    if (get().open) void get().markSeen(list.filter(isUnseen).map((j) => j.id));
    for (const job of done) {
      window.dispatchEvent(new CustomEvent<AIJob>(JOB_FINISHED_EVENT, { detail: job }));
      announce(job);
    }
    return list;
  },

  cancel: async (id) => {
    await jobsApi.cancel(id);
    await get().refresh();
  },
  runNext: async (id) => {
    await jobsApi.runNext(id);
    await get().refresh();
  },
  retry: async (id) => {
    await jobsApi.retry(id);
    await get().refresh();
  },
  markSeen: async (ids) => {
    if (!ids.length) return;
    const now = new Date().toISOString();
    set((s) => ({ jobs: s.jobs.map((j) => (ids.includes(j.id) ? { ...j, seen_at: now } : j)) }));
    await jobsApi.seen(ids).catch(() => undefined);
  },

  watch: () => {
    watchers += 1;
    if (watchers === 1) start();
    return () => {
      watchers -= 1;
      if (watchers === 0) stop();
    };
  },
}));

function onMutation(e: Event) {
  // Our own "seen" write is not news; anything else may have queued a job.
  if ((e as CustomEvent<{ path?: string }>).detail?.path === "/jobs/seen") return;
  clearTimeout(timer);
  void tick();
}

async function tick() {
  if (watchers === 0) return;
  const list = await useJobsStore.getState().refresh();
  if (watchers === 0) return;
  clearTimeout(timer);
  timer = setTimeout(tick, list.some(isActive) ? BUSY_MS : IDLE_MS);
}

function start() {
  window.addEventListener(MUTATION_EVENT, onMutation);
  void tick();
}

function stop() {
  clearTimeout(timer);
  window.removeEventListener(MUTATION_EVENT, onMutation);
}
