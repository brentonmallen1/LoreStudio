import { describe, expect, it } from "vitest";
import type { ReadingData } from "../../types/numbers";
import { castThen, marksThen, sceneChanges, sharesThen, whatChanged } from "./compare";
import { readingFigures } from "./figures";

const words = (total: number, scenes: number) => ({
  total,
  by_status: { final: 0, revised: 0, draft: total, planned: 0 },
  scenes,
  written_scenes: scenes,
  mean_per_scene: 0,
  median_per_scene: 0,
  form: "",
  target: null,
  reads_as: null,
});
const scene = (
  id: string,
  chapter: string,
  n: number,
  characters: string[],
  threads: ReadingData["scenes"][0]["threads"] = [],
) => ({
  id,
  title: id.toUpperCase(),
  parent_id: chapter,
  words: n,
  status: "draft",
  pov: null,
  beat_id: null,
  characters,
  threads,
});

function reading(over: Partial<ReadingData>): ReadingData {
  return {
    version: 1,
    story_pov: null,
    words: words(300, 3),
    scenes: [],
    chapters: [
      { id: "c1", title: "Arrival" },
      { id: "c2", title: "Storm" },
    ],
    characters: [
      { id: "el", name: "Eleanor", color_slot: 1, arc: { done: 1, total: 2 } },
      { id: "ma", name: "Margaret", color_slot: 2, arc: { done: 0, total: 0 } },
    ],
    threads: [{ id: "t1", name: "The Missing Logs", status: "open", color_slot: 3 }],
    beats: [{ id: "mid", name: "Midpoint", at: 0.5 }],
    dialogue: { total_lines: 10, unattributed: 0, balance: 70, speakers: [] },
    prose: null,
    findings: { pov_drift: 4 },
    summaries: { fresh: 0, stale: 0, missing: 3 },
    ...over,
  };
}

const then = readingFigures(
  reading({
    scenes: [
      scene("a", "c1", 100, ["el"], [{ id: "t1", role: "opens", note: "" }]),
      scene("b", "c1", 100, ["el"]),
      scene("gone", "c2", 100, ["el", "ma"]),
    ],
    dialogue: {
      total_lines: 10,
      unattributed: 0,
      balance: 70,
      speakers: [
        { speaker_name: "Eleanor", character_id: "el", line_count: 6, word_count: 75 },
        { speaker_name: "Margaret", character_id: "ma", line_count: 4, word_count: 25 },
      ],
    },
  }),
);
const now = readingFigures(
  reading({
    words: words(500, 3),
    scenes: [
      scene("b", "c1", 150, ["el", "ma"]),
      scene("a", "c1", 100, ["el"], [{ id: "t1", role: "opens", note: "" }]),
      scene("new", "c2", 250, ["el", "ma"], [{ id: "t1", role: "closes", note: "" }]),
    ],
    threads: [{ id: "t1", name: "The Missing Logs", status: "resolved", color_slot: 3 }],
    dialogue: { total_lines: 14, unattributed: 0, balance: 82, speakers: [] },
    findings: { pov_drift: 2 },
  }),
);

describe("readingFigures", () => {
  it("draws a reading with the live page's chart inputs", () => {
    expect(now.bars.map((b) => [b.id, b.words, b.group])).toEqual([
      ["b", 150, "c1"],
      ["a", 100, "c1"],
      ["new", 250, "c2"],
    ]);
    expect(now.lanes[0].marks.map((m) => [m.index, m.role])).toEqual([
      [1, "opens"],
      [2, "closes"],
    ]);
    expect(now.chapters.map((c) => [c.title, c.first, c.count])).toEqual([
      ["Arrival", 0, 2],
      ["Storm", 2, 1],
    ]);
    expect(now.cast.find((r) => r.character.id === "el")!.milestones).toEqual({ done: 1, total: 2 });
    expect(now.beats[0]).toMatchObject({ id: "mid", at: 0.5 });
  });
});

describe("compare", () => {
  it("matches scenes by id: added, removed and moved", () => {
    const c = sceneChanges(then, now);
    expect([...c.added]).toEqual(["new"]);
    expect(c.removed).toEqual([{ id: "gone", title: "GONE" }]);
    expect(c.moved.map((m) => m.id).sort()).toEqual(["a", "b"]);
    expect(c.wordsThen.get("b")).toBe(100);
  });

  it("keeps what each character, thread and speaker had then", () => {
    expect([...castThen(then).get("ma")!]).toEqual(["gone"]);
    expect([...marksThen(then).get("t1")!]).toEqual(["a:opens"]);
    expect(sharesThen(then).get("el")).toBe(75);
  });

  it("says what changed in plain sentences, without judging it", () => {
    const said = whatChanged(then, now);
    expect(said[0]).toBe("200 more words, 1 new scene, 1 scene removed (“GONE”) and 2 scenes moved.");
    expect(said).toContain("Margaret is on the page in 1 more scene.");
    expect(said).toContain("The Missing Logs went from open to resolved.");
    expect(said).toContain("4 more lines of dialogue, balance 70 → 82.");
    expect(said).toContain("Open findings: 4 → 2.");
    expect(said.join(" ")).not.toMatch(/\b(better|worse|improved|good|bad)\b/i);
  });

  it("says when prose was not measured by then", () => {
    const measured = readingFigures(
      reading({
        prose: {
          run_id: "r",
          run_at: "2026-10-01T00:00:00",
          scenes: 1,
          passive_pct: 2,
          adverb_pct: 1,
          mean_sentence: 9,
          sentence_lengths: [],
          by_scene: [],
        },
      }),
    );
    expect(whatChanged(then, measured)).toContain("Prose was not measured by then.");
  });
});
