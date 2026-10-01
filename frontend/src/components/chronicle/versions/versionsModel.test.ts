import { describe, expect, it } from "vitest";
import type { SnapshotDeltaSummary, StorySnapshot } from "../../../types";
import {
  deltaDetailEntries,
  deltaSummaryParts,
  filenameFromDisposition,
  formatDelta,
  groupSnapshots,
  orderByAge,
  versionsSubtitle,
} from "./versionsModel";

const snap = (over: Partial<StorySnapshot>): StorySnapshot =>
  ({
    id: "s",
    story_id: "story",
    name: null,
    trigger: "manual",
    base_snapshot_id: null,
    summary: null,
    delta_summary: null,
    created_at: "2026-09-01T10:00:00",
    ...over,
  }) as StorySnapshot;

const delta = (over: Partial<SnapshotDeltaSummary>): SnapshotDeltaSummary => ({
  word_count_delta: 0,
  scenes_added: 0,
  scenes_removed: 0,
  scenes_modified: 0,
  characters_added: 0,
  characters_modified: 0,
  threads_added: 0,
  threads_modified: 0,
  ...over,
});

describe("formatDelta", () => {
  it("signs non-zero numbers and blanks zero", () => {
    expect(formatDelta(0)).toBe("");
    expect(formatDelta(12)).toBe("+12");
    expect(formatDelta(-3)).toBe("-3");
  });
});

describe("deltaSummaryParts", () => {
  it("is empty when nothing changed", () => {
    expect(deltaSummaryParts(delta({}))).toEqual([]);
  });

  it("puts the word count first and pluralises", () => {
    expect(
      deltaSummaryParts(
        delta({ word_count_delta: 40, scenes_added: 1, scenes_modified: 2, threads_added: 3 }),
      ),
    ).toEqual(["+40 words", "+1 scene", "2 scenes modified", "+3 threads"]);
  });

  it("marks removals with a minus", () => {
    expect(deltaSummaryParts(delta({ scenes_removed: 2 }))).toEqual(["-2 scenes"]);
  });
});

describe("deltaDetailEntries", () => {
  it("lists non-zero fields with readable labels", () => {
    expect(deltaDetailEntries(delta({ scenes_added: 2, word_count_delta: -5 }))).toEqual([
      ["word count delta", "-5"],
      ["scenes added", "+2"],
    ]);
  });
});

describe("versionsSubtitle", () => {
  it("counts snapshots and mentions auto backups only when present", () => {
    expect(versionsSubtitle([])).toBe("0 snapshots");
    expect(versionsSubtitle([snap({ id: "a" })])).toBe("1 snapshot");
    expect(versionsSubtitle([snap({ id: "a" }), snap({ id: "b", trigger: "auto" })])).toBe(
      "1 snapshot · 1 auto backup",
    );
  });
});

describe("orderByAge", () => {
  it("returns the older snapshot first either way round", () => {
    const old = snap({ id: "old", created_at: "2026-01-01T00:00:00" });
    const recent = snap({ id: "new", created_at: "2026-02-01T00:00:00" });
    expect(orderByAge(recent, old).map((s) => s.id)).toEqual(["old", "new"]);
    expect(orderByAge(old, recent).map((s) => s.id)).toEqual(["old", "new"]);
  });
});

describe("filenameFromDisposition", () => {
  it("reads the quoted filename or falls back", () => {
    expect(filenameFromDisposition('attachment; filename="tale.lorestudio.zip"')).toBe("tale.lorestudio.zip");
    expect(filenameFromDisposition(null)).toBe("snapshot.lorestudio.zip");
  });
});

describe("groupSnapshots", () => {
  it("nests auto backups under their anchor, newest first, with orphans last", () => {
    const groups = groupSnapshots([
      snap({ id: "m1", created_at: "2026-09-01T00:00:00" }),
      snap({ id: "m2", created_at: "2026-09-05T00:00:00" }),
      snap({ id: "a1", trigger: "auto", base_snapshot_id: "m1", created_at: "2026-09-02T00:00:00" }),
      snap({ id: "a2", trigger: "auto", base_snapshot_id: "m1", created_at: "2026-09-03T00:00:00" }),
      snap({ id: "o1", trigger: "auto", base_snapshot_id: "gone", created_at: "2026-08-01T00:00:00" }),
    ]);
    expect(groups.map((g) => g.anchor?.id ?? null)).toEqual(["m2", "m1", null]);
    expect(groups[1].autoBackups.map((s) => s.id)).toEqual(["a2", "a1"]);
    expect(groups[2].autoBackups.map((s) => s.id)).toEqual(["o1"]);
  });

  it("has no ungrouped group when every backup has its anchor", () => {
    expect(groupSnapshots([snap({ id: "m1" })])).toEqual([
      { anchor: expect.objectContaining({ id: "m1" }), autoBackups: [] },
    ]);
  });
});
