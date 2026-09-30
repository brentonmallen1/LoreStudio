import { describe, expect, it } from "vitest";
import type { Character, Location, PlotThread, StructureNode } from "../../types";
import type { SceneCast } from "../../types/panel";
import { entityPresence, presenceLine } from "./presence";

const node = (id: string, title: string, content = "", children: StructureNode[] = []) =>
  ({ id, title, content, synopsis: "", children }) as unknown as StructureNode;

const eleanor = { id: "c1", name: "Eleanor Vance" } as Character;
const lighthouse = { id: "l1", name: "The Lighthouse" } as Location;
const logs = { id: "t1", name: "The Missing Logs", appearances: [{ node_id: "s3" }] } as PlotThread;

const structure = [
  node("ch1", "Chapter 1", "", [
    node("s1", "The Light", "<p>Eleanor climbed.</p>"),
    node("s2", "Knock", "<p>Rain.</p>"),
  ]),
  node("ch2", "Chapter 2", "", [node("s3", "The Logbook", "<p>The logs.</p>")]),
];
const cast: SceneCast = {
  scenes: [
    {
      node_id: "s1",
      character_ids: ["c1"],
      location_ids: ["l1"],
      thread_ids: [],
      beat_id: null,
      status: "draft",
      word_count: 2,
      opening: "",
    },
    {
      node_id: "s2",
      character_ids: [],
      location_ids: [],
      thread_ids: [],
      beat_id: null,
      status: "draft",
      word_count: 1,
      opening: "",
    },
    {
      node_id: "s3",
      character_ids: [],
      location_ids: [],
      thread_ids: ["t1"],
      beat_id: null,
      status: "draft",
      word_count: 2,
      opening: "",
    },
  ],
};

describe("entityPresence", () => {
  it("reads the open page live and counts the mentions", () => {
    const p = entityPresence("character", eleanor, structure[0].children[0], structure, cast);
    expect(p).toEqual({ onPage: true, count: 1, lastSeen: null });
    expect(presenceLine(p)).toBe("On this page once.");
  });

  it("looks back for the last scene they were in", () => {
    const p = entityPresence("character", eleanor, structure[0].children[1], structure, cast);
    expect(p.onPage).toBe(false);
    expect(p.lastSeen).toEqual({ nodeId: "s1", title: "The Light" });
    expect(presenceLine(p)).toBe("Not on this page. Last seen in “The Light”.");
  });

  it("falls forward to a later scene when nothing earlier has them", () => {
    const p = entityPresence("thread", logs, structure[0].children[0], structure, cast);
    expect(p.lastSeen).toEqual({ nodeId: "s3", title: "The Logbook", later: true });
    expect(presenceLine(p)).toBe("Not on this page yet. First appears in “The Logbook”.");
  });

  it("places by [[name]] or plain name, and threads by appearance", () => {
    const place = entityPresence(
      "location",
      lighthouse,
      node("x", "X", "<p>Up in [[The Lighthouse]].</p>"),
      structure,
      cast,
    );
    expect(place.onPage).toBe(true);
    const thread = entityPresence("thread", logs, structure[1].children[0], structure, cast);
    expect(thread.onPage).toBe(true);
  });

  it("says so when they are nowhere yet", () => {
    const nobody = { id: "c9", name: "Nobody" } as Character;
    expect(presenceLine(entityPresence("character", nobody, null, structure, cast))).toMatch(
      /anywhere in the manuscript yet/,
    );
  });
});
