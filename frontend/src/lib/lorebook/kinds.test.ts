import { describe, expect, it } from "vitest";
import { KINDS, locationFields, splitFields, typeLabel, typeValue } from "./kinds";
import { scenesWith, presenceLine } from "./presence";
import type { StructureNode } from "../../types";

describe("lorebook kinds", () => {
  it("field keys are unique within a kind and every kind has a field", () => {
    for (const [kind, spec] of Object.entries(KINDS)) {
      const keys = spec.fields.map((f) => f.key);
      expect(new Set(keys).size, kind).toBe(keys.length);
      expect(keys.length, kind).toBeGreaterThan(0);
    }
  });

  it("the character sheet keeps every text field the old sheet had", () => {
    const keys = new Set(KINDS.character.fields.map((f) => f.key));
    const old = ["mission_statement", "personality", "motivation", "conflict", "epiphany", "background"];
    const more = [
      "appearance",
      "flaws",
      "quirks",
      "speech_patterns",
      "arc_notes",
      "narrative_intent",
      "arc_in_own_words",
    ];
    for (const k of [...old, ...more]) expect(keys.has(k), k).toBe(true);
  });

  it("the compact sheet is the full sheet's top: every compact field is a field", () => {
    for (const spec of Object.values(KINDS)) {
      for (const f of spec.fields.filter((x) => x.compact)) expect(spec.fields).toContain(f);
    }
    expect(KINDS.character.fields.filter((f) => f.compact).map((f) => f.key)).toEqual([
      "mission_statement",
      "conflict",
      "personality",
      "motivation",
      "flaws",
    ]);
  });

  it("splits filled from empty, so an empty field is a word in the Add row", () => {
    const { filled, empty } = splitFields(KINDS.twist.fields, {
      the_truth: "He tore the pages out.",
      the_misdirection: "  ",
    });
    expect(filled.map((f) => f.key)).toEqual(["the_truth"]);
    expect(empty.map((f) => f.key)).toEqual(["the_misdirection"]);
  });

  it("only celestial places, or ones already filled, carry the celestial fields", () => {
    expect(locationFields("structure", {}).some((f) => f.key === "gravity")).toBe(false);
    expect(locationFields("planet", {}).some((f) => f.key === "gravity")).toBe(true);
    expect(locationFields("gas giant", {}).some((f) => f.key === "gravity")).toBe(true);
    expect(locationFields("structure", { gravity: "1 g" }).some((f) => f.key === "gravity")).toBe(true);
  });
});

describe("place types", () => {
  it("read with spaces and save as stored", () => {
    expect(typeLabel("natural_feature")).toBe("natural feature");
    expect(typeValue(" Natural  feature ")).toBe("natural_feature");
  });
});

describe("lorebook presence", () => {
  const node = (id: string, title: string, position: number): StructureNode =>
    ({ id, title, position, level: 0, word_count: 10, children: [] }) as unknown as StructureNode;
  const structure = [node("b", "Second", 1), node("a", "First", 0), node("c", "Third", 2)];
  const cast = {
    scenes: [
      {
        node_id: "a",
        character_ids: ["el"],
        location_ids: [],
        thread_ids: [],
        beat_id: null,
        status: "draft",
        word_count: 1,
        opening: "",
      },
      {
        node_id: "c",
        character_ids: ["el", "ma"],
        location_ids: ["lh"],
        thread_ids: [],
        beat_id: null,
        status: "draft",
        word_count: 1,
        opening: "",
      },
    ],
  };

  it("lists the scenes an entity is in, in story order, by title", () => {
    expect(scenesWith("character", "el", cast, structure, null)).toEqual([
      { id: "a", title: "First" },
      { id: "c", title: "Third" },
    ]);
    expect(scenesWith("location", "lh", cast, structure, null)).toEqual([{ id: "c", title: "Third" }]);
  });

  it("says where in words", () => {
    const scenes = scenesWith("character", "el", cast, structure, null);
    expect(presenceLine(scenes, 3)).toBe("On the page in 2 of 3 scenes · first in First, last in Third");
    expect(presenceLine([], 3)).toBe("Not on the page yet");
    expect(presenceLine([{ id: "c", title: "Third" }], 3)).toBe("On the page in Third");
  });
});
