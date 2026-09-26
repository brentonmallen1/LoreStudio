import { describe, expect, it } from "vitest";
import type { AIJob } from "../../api/jobs";
import type { ActivityLog } from "../../types";
import {
  callLabel,
  dayLabel,
  formatDuration,
  groupByDay,
  jobOutcome,
  jobParams,
  noCallsNote,
  plainText,
} from "./timelineFormat";

const job = (over: Partial<AIJob>): AIJob => ({
  id: "j",
  kind: "x",
  label: "Job",
  status: "done",
  story_id: "s",
  params: {},
  progress: 0,
  total: 0,
  result: null,
  error: null,
  created_at: "2026-09-26T10:00:00",
  started_at: "2026-09-26T10:00:00",
  finished_at: "2026-09-26T10:00:02",
  ...over,
});

describe("days", () => {
  const now = new Date(2026, 8, 26, 15, 0);
  const local = (d: Date) => d.toISOString().replace("Z", "");

  it("names today and yesterday, and dates the rest", () => {
    expect(dayLabel(local(new Date(2026, 8, 26, 9)), now)).toBe("Today");
    expect(dayLabel(local(new Date(2026, 8, 25, 23)), now)).toBe("Yesterday");
    expect(dayLabel(local(new Date(2026, 8, 20, 12)), now)).toContain("20");
    expect(dayLabel(local(new Date(2025, 8, 20, 12)), now)).toContain("2025");
  });

  it("groups consecutive rows by day, keeping their order", () => {
    const rows = [
      { at: local(new Date(2026, 8, 26, 12)) },
      { at: local(new Date(2026, 8, 26, 9)) },
      { at: local(new Date(2026, 8, 25, 9)) },
    ];
    expect(groupByDay(rows, now).map(([label, r]) => [label, r.length])).toEqual([
      ["Today", 2],
      ["Yesterday", 1],
    ]);
  });
});

describe("call labels", () => {
  const log = (prompt: string, feature = "codex-suggest") =>
    ({ event_type: "ai_x", metadata_: { prompt, feature } }) as unknown as ActivityLog;

  it("name the scene a scene pass was reading", () => {
    expect(callLabel(log("Scene: The Light\n\n<p>The barometer…</p>"))).toBe("The Light");
  });

  it("fall back to the feature when the prompt says nothing", () => {
    expect(callLabel(log("Index this scene."))).not.toBe("Index this scene.");
  });
});

describe("previews", () => {
  it("strip the scene HTML a prompt carries", () => {
    expect(plainText("Scene: The Logbook <p>The logs were kept &amp; labelled.</p><p>Next</p>")).toBe(
      "Scene: The Logbook The logs were kept & labelled. Next",
    );
  });

  it("say nothing for things that are not text", () => {
    expect(plainText(undefined)).toBe("");
  });

  it("read durations the way a person would", () => {
    expect(formatDuration(420)).toBe("420ms");
    expect(formatDuration(1400)).toBe("1.4s");
    expect(formatDuration(130_000)).toBe("2m 10s");
  });
});

describe("what a job did", () => {
  it("scene summaries, in a sentence", () => {
    const out = jobOutcome(
      job({ kind: "scene-summaries", result: { summarized_count: 3, skipped_count: 7, failed_count: 0 } }),
    );
    expect(out.sentence).toBe("Summarised 3 scenes; 7 skipped (empty or already current).");
  });

  it("the graph, with its counts in words rather than keys", () => {
    const out = jobOutcome(
      job({ kind: "codex-sync", result: { nodes: 34, edges: 78, rel: 5, present_in: 24 } }),
    );
    expect(out.sentence).toBe("Built the graph: 34 things and 78 connections.");
    expect(out.details).toEqual([
      ["relationships", "5"],
      ["appearances", "24"],
    ]);
  });

  it("the suggestion pass, counting what waits for review", () => {
    const out = jobOutcome(job({ kind: "codex-suggest", result: { scenes: 1, presence: 1, facts: 0 } }));
    expect(out.sentence).toBe("Read 1 scene and proposed 1 entry for you to review.");
  });

  it("the index, naming the model", () => {
    const out = jobOutcome(
      job({
        kind: "codex-index",
        result: { chunks: 43, embedded: 2, reused: 41, removed: 0, model: "nomic" },
      }),
    );
    expect(out.sentence).toBe("Indexed 43 passages; embedded 2 with nomic.");
    expect(out.details).toEqual([["unchanged, kept", "41"]]);
  });

  it("claims nothing for a job with no result", () => {
    expect(jobOutcome(job({ kind: "codex-suggest", status: "error", result: null }))).toEqual({
      sentence: "",
      details: [],
    });
  });

  it("explains an empty call list instead of showing nothing", () => {
    expect(noCallsNote(job({ kind: "codex-sync" }))).toMatch(/nothing was sent to a model/);
    expect(noCallsNote(job({ kind: "scene-summaries" }))).toMatch(/did not record/);
  });

  it("lists only the parameters that were set", () => {
    expect(
      jobParams(job({ params: { force_refresh: true, up_to_node_id: null, node_ids: ["a", "b"] } })),
    ).toEqual([
      ["Redo summaries that are current", "yes"],
      ["Only these scenes", "2 scenes"],
    ]);
  });
});
