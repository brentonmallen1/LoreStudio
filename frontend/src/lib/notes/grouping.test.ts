import { describe, expect, it } from "vitest";
import type { Note } from "../../types/notes";
import { countByKind, filterNotes, groupNotes } from "./grouping";

const note = (id: string, over: Partial<Note> = {}): Note => ({
  id,
  story_id: "s",
  kind: "note",
  content: id,
  node_id: null,
  anchor: null,
  about_type: null,
  about_id: null,
  answer: "",
  done: false,
  source: null,
  category: null,
  position: 0,
  created_at: "",
  updated_at: "",
  node_title: null,
  ...over,
});

const ctx = {
  scenes: [
    { id: "s1", title: "The Light", parent: "Chapter 1" },
    { id: "s2", title: "The Logbook", parent: "Chapter 3" },
  ],
  characters: [
    { id: "c1", name: "Thomas" },
    { id: "c2", name: "Eleanor" },
  ],
  places: [{ id: "p1", name: "Harrow Island" }],
};

describe("groupNotes", () => {
  it("puts loose notes first, then scenes in reading order, then people, then places", () => {
    const notes = [
      note("a", { node_id: "s2" }),
      note("b", { about_type: "location", about_id: "p1" }),
      note("c", { kind: "idea" }),
      note("d", { node_id: "s1", anchor: "still" }),
      note("e", { about_type: "character", about_id: "c1" }),
      note("f", { about_type: "character", about_id: "c2" }),
    ];
    const groups = groupNotes(notes, ctx);
    expect(groups.map((g) => g.title)).toEqual([
      "Not tied yet",
      "The Light",
      "The Logbook",
      "Eleanor",
      "Thomas",
      "Harrow Island",
    ]);
    expect(groups[1]).toMatchObject({ meta: "Chapter 1", to: { kind: "scene", id: "s1" } });
    expect(groups[5].to).toEqual({ kind: "place", id: "p1" });
  });

  it("counts a note whose scene is gone as not tied", () => {
    expect(groupNotes([note("x", { node_id: "gone" })], ctx)[0].key).toBe("loose");
  });
});

describe("filterNotes", () => {
  const notes = [note("q", { kind: "question", done: true }), note("t", { kind: "todo" }), note("n")];
  it("filters by kind and by open or done", () => {
    expect(filterNotes(notes, null, "open").map((n) => n.id)).toEqual(["t", "n"]);
    expect(filterNotes(notes, ["question"], "done").map((n) => n.id)).toEqual(["q"]);
    expect(filterNotes(notes, ["todo", "note"], "all")).toHaveLength(2);
  });
  it("counts each kind", () => {
    expect(countByKind(notes)).toEqual({ note: 1, question: 1, todo: 1, idea: 0 });
  });
});
