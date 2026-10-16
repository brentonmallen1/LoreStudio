import { api } from "../../api/client";
import { promisesApi } from "../../api/promises";
import type { SubjectType } from "../../api/assistantResults";
import type { StructuredResult } from "../../types";
import FEATURES from "./featureRegistry";

/** The thing a sheet's Assistant answers about (A6). */
export interface Subject {
  storyId: string;
  type: SubjectType;
  id: string;
  name: string;
}

/**
 * One item of a sheet's "Assistant ▾" menu. Its words come from its row in `lib/ai/registry`
 * (`id`), so the menu, the info modal and the Chronicle name a feature alike.
 */
export interface SheetAction {
  id: string;
  /** Runs once; the server keeps a good answer on the subject, shown under the header. */
  run?: () => Promise<StructuredResult>;
  /** Opens a conversation (Feather) or a dialog instead. */
  open?: () => void;
  chat?: boolean;
}

/** The one-shot actions a subject's sheet offers, beside and in the side panel alike. */
export function runActions(s: Subject): SheetAction[] {
  const { storyId, id } = s;
  switch (s.type) {
    case "location":
      return [
        { id: "wb-what-exists", run: () => api.analyzeLocationExistence(storyId, id) },
        { id: "wb-location-suggest", run: () => api.suggestWorldElements(storyId, "location", id) },
      ];
    case "culture":
      return [{ id: "wb-culture-suggest", run: () => api.suggestWorldElements(storyId, "culture", id) }];
    case "world_system":
      return [{ id: "wb-system", run: () => api.analyzeWorldSystem(storyId, id) }];
    case "calendar":
      return [{ id: "wb-calendar", run: () => api.suggestCalendarEvents(storyId, id) }];
    case "location_travel":
      return [{ id: "wb-travel", run: () => api.analyzeTravelRoute(storyId, id) }];
    case "historical_event":
      return [{ id: "wb-implications", run: () => api.analyzeHistoricalImplications(storyId, id) }];
    case "plot_thread":
      return [{ id: "thread-analysis", run: () => promisesApi.analyzeThread(id) }];
    case "twist":
      return [
        { id: "twist-analysis", run: () => promisesApi.analyzeTwist(id) },
        { id: "twist-impact", run: () => api.analyzeTwistImpact(id) },
      ];
    case "character":
      return [
        { id: "character-dimensionality", run: () => api.assessCharacterDimensionality(id) },
        { id: "arc-analysis", run: () => api.analyzeCharacterArc(id) },
        { id: "voice-fidelity", run: () => api.analyzeCharacterVoiceFidelity(id) },
      ];
    default:
      // A scene, an image, an outline or the story: their answers show where they were asked (A7).
      return [];
  }
}

/**
 * Kept answers about a sheet's thing that have a place of their own and stay out of its band:
 * Careful's verdicts belong to the pronoun review, relationship ideas to the Relationships view.
 */
export const KEPT_ELSEWHERE = new Set(["pronoun-identification", "relationship-suggest"]);

/** The gateway feature an action's answer is kept under. */
export function backendFeature(actionId: string): string | undefined {
  return FEATURES[actionId]?.backendFeatureId;
}

/** The action that asks a kept answer's question again, when the sheet offers one. */
export function actionFor(feature: string, actions: SheetAction[]): SheetAction | undefined {
  return actions.find((a) => backendFeature(a.id) === feature);
}

/** A kept answer's name, as its menu item says it; the server's heading otherwise. */
export function answerLabel(feature: string, subject: Subject, heading: string): string {
  const action = actionFor(feature, runActions(subject));
  return (action && FEATURES[action.id]?.label) || heading;
}
