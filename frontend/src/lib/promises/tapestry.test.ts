import { describe, expect, it } from "vitest";
import type { Promises } from "../../types/promises";
import { tapestryLanes } from "./tapestry";

const scene = (i: number) => ({ id: `s${i}`, title: `S${i}`, index: i, chapter_id: null, written: true });

const data: Promises = {
  scenes: [0, 1, 2, 3].map(scene),
  chapters: [],
  threads: [
    {
      id: "t",
      name: "Logs",
      description: "",
      color_slot: 1,
      mice_type: null,
      status: "resolved",
      beats: [
        { node_id: "s0", index: 0, role: "opens", note: "" },
        { node_id: "s1", index: 1, role: "fails_worse", note: "worse" },
        { node_id: "s3", index: 3, role: "closes", note: "" },
      ],
    },
  ],
  twists: [
    {
      id: "w",
      name: "Lie",
      color_slot: 7,
      status: "revealed",
      twist_type: "reveal",
      the_truth: "",
      the_misdirection: "",
      reveal_node_id: "s2",
      reveal_index: 2,
      clues: [
        { id: "c", node_id: "s1", index: 1, text: "ash", points_to: "truth", subtlety: "hidden", quote: "" },
        {
          id: "d",
          node_id: null,
          index: null,
          text: "unplaced",
          points_to: "truth",
          subtlety: "hidden",
          quote: "",
        },
      ],
    },
  ],
  setups: [
    {
      id: "l",
      link_type: "callback",
      from_node_id: "s0",
      to_node_id: "s3",
      from_index: 0,
      to_index: 3,
      note: "",
    },
  ],
  reader: [],
  checks: [],
};

describe("tapestry lanes", () => {
  const [threads, twists, setups] = tapestryLanes(data);

  it("marks each thread scene by what it does, and spans first to last", () => {
    const lane = threads.lanes[0];
    expect(lane.marks.map((m) => m.shape)).toEqual(["opens", "fails", "closes"]);
    expect(lane.marks[1].label).toBe("S1: fails, worse. worse");
    expect(lane.span).toEqual([0, 3]);
    expect(lane.color).toBe("var(--cat-1)");
  });

  it("draws placed clues and the reveal in the twist's colour, leaving unplaced clues off", () => {
    const lane = twists.lanes[0];
    expect(lane.marks.map((m) => [m.index, m.shape])).toEqual([
      [1, "toward"],
      [2, "reveal"],
    ]);
    expect(lane.color).toBe("var(--cat-7)");
  });

  it("reads a setup as a sentence, earlier scene to later", () => {
    expect(setups.lanes[0].name).toBe("S3 calls back to S0");
    expect(setups.lanes[0].marks.map((m) => m.shape)).toEqual(["setup", "payoff"]);
  });
});
