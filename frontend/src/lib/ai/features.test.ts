import { describe, expect, it } from "vitest";
import FEATURES, { PAGE_FEATURES, PAGE_LABELS } from "./featureRegistry";
import { AI_FEATURES, AI_FEATURES_BY_ID, aiFeatureLabel } from "./features.generated";

/**
 * The backend table (services/llm/features.py) is the source for feature ids; this file
 * is what stops the frontend from drifting off it again. Five registry entries used to
 * point at backend ids that never existed, so the transparency preview silently showed
 * nothing.
 */
describe("AI feature registry", () => {
  it("only references backend feature ids that exist", () => {
    const unknown = Object.values(FEATURES)
      .filter((f) => f.backendFeatureId && !AI_FEATURES_BY_ID[f.backendFeatureId])
      .map((f) => `${f.id} -> ${f.backendFeatureId}`);
    expect(unknown).toEqual([]);
  });

  it("lists only registered features on each page, and labels every page", () => {
    const unknown: string[] = [];
    for (const [page, ids] of Object.entries(PAGE_FEATURES)) {
      expect(PAGE_LABELS[page], `page ${page} has no label`).toBeTruthy();
      unknown.push(...ids.filter((id) => !FEATURES[id]).map((id) => `${page}: ${id}`));
    }
    expect(unknown).toEqual([]);
  });

  it("covers every author-facing backend feature", () => {
    // Background features (titling, compaction, batch summaries) are logged but never
    // started by the author, so they need no registry entry.
    const referenced = new Set(Object.values(FEATURES).map((f) => f.backendFeatureId));
    const missing = AI_FEATURES.filter((f) => f.group !== "system" && !referenced.has(f.id)).map((f) => f.id);
    expect(missing).toEqual([]);
  });
});

describe("aiFeatureLabel", () => {
  it("uses the table", () => {
    expect(aiFeatureLabel("interview")).toBe("Character Interview");
  });

  it("title-cases ids it does not know, so nothing renders raw", () => {
    expect(aiFeatureLabel("legacy-feature_id")).toBe("Legacy Feature Id");
  });
});
