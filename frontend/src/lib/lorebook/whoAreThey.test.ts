import { describe, expect, it } from "vitest";
import type { Character } from "../../types";
import {
  AREAS,
  FACET_FIELDS,
  FORMATIVE_FIELDS,
  KNOWN_LABELS,
  WHO_FIELDS,
  arcLine,
  newFacet,
  newFormative,
  seenByEveryone,
  whoLine,
} from "./whoAreThey";

describe("Who are they (doc 20)", () => {
  // The wording rule (P4): nothing a person is gets called an affliction or a lack.
  it("never words a person as afflicted, confined or abnormal", () => {
    const banned = /\b(suffer(s|ing)? from|confined|bound|victim|afflicted|despite|normal)\b/i;
    const words = [
      ...[...WHO_FIELDS, ...FACET_FIELDS, ...FORMATIVE_FIELDS].flatMap((f) => [
        f.label,
        f.hint,
        ...(f.options ?? []).map((o) => (typeof o === "string" ? o : `${o.value} ${o.note}`)),
      ]),
      ...Object.values(AREAS).flatMap((a) => [a.label, ...a.suggestions]),
      ...Object.values(KNOWN_LABELS),
    ];
    for (const w of words) expect(w).not.toMatch(banned);
  });

  it("says who someone is in one line, leaving out what is empty", () => {
    const elena = {
      gender: "woman",
      pronouns: "she/her",
      age: "",
      facets: [{ ...newFacet("health"), name: "Parkinson's" }],
    };
    expect(whoLine(elena)).toBe("woman · she/her · Parkinson's");
    expect(whoLine({ gender: "", pronouns: "", age: "", facets: [] })).toBe("");
  });

  it("shows on a hover card only what everyone in the story knows", () => {
    const cane = { ...newFacet("moving"), name: "uses a cane", page: "the cane hooked over the rail" };
    const secret = { ...newFacet("health"), name: "Parkinson's", known: "some" as const };
    expect(seenByEveryone({ facets: [cane, secret] })).toEqual([
      { name: "uses a cane", page: "the cane hooked over the rail" },
    ]);
  });

  it("reads the arc in one line, the wound first and blanks as blanks", () => {
    const c = {
      formative: [{ ...newFormative(), title: "Her father's last two months", wound: true }],
      lie: "Silence is a kind of loyalty",
      mission_statement: "The truth about the logs",
      need: "",
      conflict: "The Visitor knows more",
      epiphany: "",
    } as unknown as Character;
    expect(arcLine(c).map((s) => s.value)).toEqual([
      "Her father's last two months",
      "Silence is a kind of loyalty",
      "The truth about the logs",
      "",
      "The Visitor knows more",
      "",
    ]);
  });

  it("starts a new entry everyone knows (body and mind) or only they know (what formed them)", () => {
    expect(newFacet("senses").known).toBe("everyone");
    expect(newFormative().known).toBe("only_them");
    expect(newFacet("senses").assistant && newFormative().assistant).toBe(true);
  });
});
