import { describe, expect, it } from "vitest";
import { clearDraft, loadDraft, saveDraft } from "./draftBuffer";

// happy-dom has no IndexedDB, so this exercises the in-memory fallback path.
describe("draftBuffer", () => {
  it("round-trips a draft and clears it", async () => {
    await saveDraft("n1", "<p>hello</p>");
    const d = await loadDraft("n1");
    expect(d?.content).toBe("<p>hello</p>");
    expect(d?.savedAt).toBeGreaterThan(0);
    await clearDraft("n1");
    expect(await loadDraft("n1")).toBeNull();
  });

  it("returns null for unknown nodes", async () => {
    expect(await loadDraft("nope")).toBeNull();
  });
});
