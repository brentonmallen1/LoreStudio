import { describe, expect, it } from "vitest";
import type { ProposedDialogueTag } from "../../types";
import { withKeptSpeakers } from "./keptSpeakers";

const tag = (quote: string, speaker: string | null, confidence = 0.4): ProposedDialogueTag => ({
  id: quote,
  quote_content: quote,
  inferred_speaker: speaker,
  character_id: null,
  confidence,
  source_excerpt: "",
});

describe("the Assistant's kept speakers over the rule-based proposals", () => {
  it("takes the kept speaker for the same line, whatever its case and spacing", () => {
    const out = withKeptSpeakers([tag("Hello there,", null)], [tag(" hello there, ", "Maya", 0.9)]);
    expect(out[0].inferred_speaker).toBe("Maya");
    expect(out[0].confidence).toBe(0.9);
    expect(out[0].id).toBe("Hello there,");
  });

  it("leaves a line the Assistant did not name, and proposes nothing for a line tagged since", () => {
    const out = withKeptSpeakers([tag("Who are you?", "Levi")], [tag("Hello there,", "Maya")]);
    expect(out).toEqual([tag("Who are you?", "Levi")]);
  });
});
