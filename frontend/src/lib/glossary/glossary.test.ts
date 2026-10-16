import { describe, expect, it } from "vitest";
import glossaryMd from "../../guides/glossary.md?raw";
import { headingId } from "../guides/headings";
import { GLOSSARY_GROUPS, allTerms, entriesFor, glossaryEntry, glossaryHref } from "./index";
import { markedTerms, parseTerms, plainTerms } from "./markup";

describe("the glossary", () => {
  it("gives every entry its own id", () => {
    const ids = allTerms().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("draws every group in the guide, and the guide names no group that is not there", () => {
    const markers = [...glossaryMd.matchAll(/^<!-- terms:([a-z]+) -->$/gm)].map((m) => m[1]);
    expect(markers.sort()).toEqual(GLOSSARY_GROUPS.map((g) => g.id).sort());
  });

  it("keeps entry anchors apart from the guide's headings, so a link lands on the word", () => {
    const headings = [...glossaryMd.matchAll(/^#{2,3} (.+)$/gm)].map((m) => headingId(m[1]));
    const clash = allTerms().filter((e) => headings.includes(e.id));
    expect(clash.map((e) => e.id)).toEqual([]);
  });

  it("says nothing about AI in an entry Writer mode shows", () => {
    const ai = /\b(AI|Assistant|Ollama|LLM|Codex|model)\b/;
    const loud = allTerms()
      .filter((e) => !("studio" in e && e.studio))
      .filter((e) => ai.test([e.definition, e.example ?? "", ...(e.alsoCalled ?? [])].join(" ")));
    expect(loud.map((e) => e.id)).toEqual([]);
  });

  it("writes no em dash", () => {
    const dashed = allTerms().filter((e) => /—/.test(JSON.stringify(e)));
    expect(dashed.map((e) => e.id)).toEqual([]);
  });

  it("leaves a Studio entry out of Writer mode's list", () => {
    const parts = GLOSSARY_GROUPS.find((g) => g.id === "parts")!;
    expect(entriesFor(parts, "studio").some((e) => e.id === "codex")).toBe(true);
    expect(entriesFor(parts, "writer").some((e) => e.id === "codex")).toBe(false);
  });

  it("finds an entry and its address", () => {
    expect(glossaryEntry("logline")?.term).toBe("Logline");
    expect(glossaryEntry("nope")).toBeUndefined();
    expect(glossaryHref("logline")).toBe("/guides/glossary#logline");
  });
});

describe("term marks in copy kept as data", () => {
  it("splits a text into words and marked terms", () => {
    expect(parseTerms("Write your {{term:logline}}: who, what, why.")).toEqual([
      "Write your ",
      { id: "logline", text: "logline" },
      ": who, what, why.",
    ]);
    expect(parseTerms("{{term:mice|MICE}} threads")).toEqual([{ id: "mice", text: "MICE" }, " threads"]);
    expect(parseTerms("No marks.")).toEqual(["No marks."]);
  });

  it("reads an id as words, and keeps the words given", () => {
    expect(plainTerms("Whose {{term:point-of-view}}? {{term:mice|MICE}}.")).toBe(
      "Whose point of view? MICE.",
    );
  });

  it("lists the ids a text marks", () => {
    expect(markedTerms("{{term:arc}} and {{term:try-fail|try/fail}}")).toEqual(["arc", "try-fail"]);
  });
});
