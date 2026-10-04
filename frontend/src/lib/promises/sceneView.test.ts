import { describe, expect, it } from "vitest";
import type { Promises } from "../../types/promises";
import { openAt, readerBy } from "./sceneView";

const scene = (i: number) => ({ id: `s${i}`, title: `S${i}`, index: i, chapter_id: null, written: true });
const thread = (id: string, beats: [number, string, string?][], status = "open") => ({
  id,
  name: id,
  description: "",
  color_slot: 1,
  mice_type: null,
  status,
  beats: beats.map(([index, role, note]) => ({ node_id: `s${index}`, index, role, note: note ?? "" })),
});

const data = {
  scenes: [0, 1, 2, 3, 4].map(scene),
  chapters: [],
  threads: [
    thread("long", [
      [0, "opens"],
      [1, "moves", "Six months gone. And more besides"],
      [4, "closes"],
    ]),
    thread("here", [
      [0, "opens"],
      [3, "moves"],
    ]),
    thread("done", [
      [0, "opens"],
      [1, "closes"],
    ]),
    thread("later", [[4, "opens"]]),
    thread("aside", [[0, "opens"]], "set_aside"),
  ],
  twists: [
    {
      id: "w",
      clues: [
        { index: 1, node_id: "s1" },
        { index: 4, node_id: "s4" },
      ],
    },
  ],
  setups: [],
  reader: [
    { node_id: "s1", index: 1, learns: [{ text: "a" }], believes: [], only: [{ text: "only" }] },
    { node_id: "s2", index: 2, learns: [], believes: [{ text: "lie", over: true }], only: [] },
  ],
  checks: [],
} as unknown as Promises;

describe("a scene's promises", () => {
  it("lists what is open at a scene and not in it, with where it last moved", () => {
    const open = openAt(data, 3);
    expect(open.map((o) => o.thread.id)).toEqual(["long"]);
    expect(open[0].line).toBe("Open since S0. Last in S1: Six months gone. And more besides.");
  });

  it("counts what the reader holds by the end of the scene", () => {
    expect(readerBy(data, 2)).toEqual({ learned: 1, clues: 1, overturned: ["lie"], only: ["only"] });
  });
});
