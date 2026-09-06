/**
 * The shape of a feature entry. Kept apart from featureRegistry.ts so the per-page
 * modules can import it without importing the registry that imports them.
 */

export type FeatureType = "ai" | "nlp";

export interface AIFeatureInfo {
  id: string;
  label: string;
  type: FeatureType;
  /** Short text for native title/tooltip (< 60 chars) */
  shortDescription: string;
  /** One-to-two sentence description for the info modal */
  fullDescription: string;
  /** Human-readable list of what data is sent */
  contextSources: string[];
  /** The gateway feature id this surface calls (services/llm/features.py). */
  backendFeatureId?: string;
}
