import { AI_FEATURES_BY_ID } from "./features.generated";
import { getSessionType } from "./sessionTypes";

/** Matches MIN_NUM_CTX in the backend gateway: never ask for a window too small to work. */
export const MIN_WINDOW = 2048;

/**
 * The context window a session's next call will actually get.
 *
 * The backend sends `num_ctx` = the feature's budget, capped by the model's own context
 * length and the user's ceiling (doc 06 §4). The meter has to divide by the same number:
 * measuring against the model maximum reported "3% used" on calls Ollama was quietly
 * truncating to its 4096 default.
 */
export function contextWindowFor(sessionTypeId: string, modelLimit: number): number {
  const featureId = getSessionType(sessionTypeId)?.backendFeatureId;
  const budget = featureId ? AI_FEATURES_BY_ID[featureId]?.budget : undefined;
  if (!budget) return modelLimit;
  return Math.max(MIN_WINDOW, Math.min(budget, modelLimit));
}
