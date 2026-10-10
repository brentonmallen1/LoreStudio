import { describe, expect, it } from "vitest";
import { GUIDES, forMode, withKeys } from "./index";

describe("guides", () => {
  it("write shortcuts as {{key:id}}, never as a hard-coded combo", () => {
    for (const g of GUIDES) {
      expect(g.body, `${g.id} has an unresolved {{key:…}}`).not.toMatch(/\{\{key:/);
    }
  });

  it("in Writer mode, say nothing about AI: Studio's parts are marked and left out", () => {
    const ai = /\b(AI|Assistant|Ollama|LLM|Codex)\b/;
    for (const g of GUIDES) {
      const writer = forMode(g.body, "writer");
      const hit = writer.split("\n").find((line) => ai.test(line));
      expect(hit, `${g.id} mentions AI outside a <!-- studio --> block`).toBeUndefined();
    }
  });

  it("keeps Studio's parts in Studio, without the markers", () => {
    const body = "Before.\n\n<!-- studio -->\nThe Assistant helps.\n<!-- /studio -->\n\nAfter.\n";
    expect(forMode(body, "writer")).toBe("Before.\n\n\nAfter.\n");
    expect(forMode(body, "studio")).toBe("Before.\n\nThe Assistant helps.\n\nAfter.\n");
  });

  it("leaves an unknown shortcut id visible so the mistake shows", () => {
    expect(withKeys("press {{key:nope}}")).toBe("press {{key:nope}}");
  });
});
