import { describe, expect, it } from "vitest";
import type { AIJob } from "../../api/jobs";
import {
  arrange,
  countLabel,
  counted,
  finishedSince,
  isUnseen,
  jobLine,
  jobOpen,
  ordinal,
  plainError,
  timeLeft,
  titleWithCount,
} from "./jobs";

function job(over: Partial<AIJob> = {}): AIJob {
  return {
    id: "j1",
    kind: "scene-summaries",
    label: "Scene summaries: The Last Lighthouse",
    status: "running",
    story_id: "s1",
    params: {},
    progress: 0,
    total: 0,
    result: null,
    error: null,
    created_at: "2026-10-06T12:00:00",
    started_at: "2026-10-06T12:00:00",
    finished_at: null,
    ...over,
  };
}

const T0 = Date.parse("2026-10-06T12:00:00Z");

describe("jobs", () => {
  it("announces a job once, and never one that had finished before the first look", () => {
    const list = [
      job({ id: "a", status: "done" }),
      job({ id: "b", status: "done" }),
      job({ id: "c" }),
      job({ id: "fast", status: "done", created_at: "2026-10-06T12:05:00" }),
    ];
    const known = new Set(["a", "b", "c"]);
    // "a" was running at the last look; "fast" was queued and done between two looks.
    expect(finishedSince(new Set(["a"]), known, T0 + 60_000, list).map((j) => j.id)).toEqual(["a", "fast"]);
    // Older than the first look: not news.
    expect(finishedSince(new Set(), known, T0 + 600_000, list)).toEqual([]);
  });

  it("counts as unseen what finished and was not shown, but not a stop or quiet work", () => {
    expect(isUnseen(job({ status: "done" }))).toBe(true);
    expect(isUnseen(job({ status: "error" }))).toBe(true);
    expect(isUnseen(job({ status: "done", seen_at: "2026-10-06T13:00:00" }))).toBe(false);
    expect(isUnseen(job({ status: "cancelled" }))).toBe(false);
    expect(isUnseen(job({ status: "done", quiet: true }))).toBe(false);
    expect(isUnseen(job())).toBe(false);
  });

  it("gives an estimate only after two steps", () => {
    expect(timeLeft(job({ progress: 1, total: 10 }), T0 + 60_000)).toBeNull();
    expect(timeLeft(job({ progress: 2, total: 10 }), T0 + 120_000)).toBe("about 8 min left");
    expect(timeLeft(job({ progress: 9, total: 10 }), T0 + 9_000)).toBe("under a minute left");
  });

  it("says what a row is doing", () => {
    expect(jobLine(job({ progress: 3, total: 12, step_label: "Reading chapter 3" }), T0)).toBe(
      "Reading chapter 3 · 3 of 12",
    );
    expect(jobLine(job({ cancel_requested: true }), T0)).toBe("Stopping after this step");
    expect(
      jobLine(
        job({ status: "queued", queue_position: 1, waiting: "Waiting: starts 41 s after your last reply" }),
        T0,
      ),
    ).toBe("Waiting: starts 41 s after your last reply · 1st in line");
    expect(jobLine(job({ status: "queued", queue_position: 2 }), T0)).toBe("Waiting · 2nd in line");
    expect(
      jobLine(job({ status: "queued", queue_position: 1, step_label: "Paused for your reply" }), T0),
    ).toBe("Paused for your reply · 1st in line");
    expect(jobLine(job({ status: "cancelled", progress: 3, total: 5 }), T0)).toBe("Stopped after 3 of 5");
    expect(jobLine(job({ status: "cancelled", progress: 0, total: 1 }), T0)).toBe("Stopped");
    expect(jobLine(job({ status: "done", result: { summarized_count: 4 } }), T0)).toBe(
      "Summarised 4 scenes.",
    );
  });

  it("puts a failure in plain words", () => {
    expect(plainError("httpx.ConnectError: [Errno 61] Connection refused")).toMatch(/model is not running/);
    expect(plainError("Interrupted by a restart twice.")).toBe("Interrupted by a restart twice.");
    expect(plainError("KeyError: 'x'\nTraceback...")).toBe("KeyError: 'x'");
    expect(plainError(null)).toBe("It failed without saying why.");
  });

  it("arranges running, queued in order, and finished unseen first", () => {
    const list = [
      job({ id: "q2", status: "queued", queue_position: 2 }),
      job({ id: "q1", status: "queued", queue_position: 1 }),
      job({ id: "old", status: "done", finished_at: "2026-10-06T12:30:00", seen_at: "2026-10-06T12:31:00" }),
      job({ id: "new", status: "done", finished_at: "2026-10-06T12:10:00" }),
      job({ id: "r" }),
    ];
    const { running, queued, finished } = arrange(list);
    expect(running.map((j) => j.id)).toEqual(["r"]);
    expect(queued.map((j) => j.id)).toEqual(["q1", "q2"]);
    expect(finished.map((j) => j.id)).toEqual(["new", "old"]);
  });

  it("opens a job where its result is", () => {
    expect(jobOpen(job({ status: "done", kind: "codex-suggest" }))?.to).toBe("/stories/s1/proposals");
    expect(jobOpen(job({ status: "error", kind: "codex-suggest" }))).toBeNull();
    expect(jobOpen(job({ status: "done", kind: "unknown" }))).toBeNull();
    expect(jobOpen(job({ status: "done", kind: "editorial-pass", result: { report_id: "r1" } }))?.to).toBe(
      "/stories/s1/chronicle?item=log:r1",
    );
    expect(jobOpen(job({ status: "done", kind: "check" }))?.to).toBe("/stories/s1/findings");
  });

  it("counts automatic work while it runs, but not while it waits", () => {
    const list = [
      job({ id: "a", status: "queued" }),
      job({ id: "b", status: "running", quiet: true }),
      job({ id: "c", status: "queued", quiet: true }),
      job({ id: "d", status: "done" }),
    ];
    expect(counted(list).map((j) => j.id)).toEqual(["a", "b"]);
  });

  it("words the count and the tab title", () => {
    expect(countLabel(1)).toBe("1 job running");
    expect(countLabel(3)).toBe("3 jobs running");
    expect(countLabel(1, true)).toBe("1 job waiting");
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(23)).toBe("23rd");
    expect(titleWithCount("LoreStudio", 2)).toBe("(2) LoreStudio");
    expect(titleWithCount("(2) LoreStudio", 0)).toBe("LoreStudio");
    expect(titleWithCount("(2) LoreStudio", 5)).toBe("(5) LoreStudio");
  });
});
