import type { AIFeatureInfo } from "./types";

/** Worldbuilding — locations, cultures, systems, eras, calendars, travel. */
export const WORLD_FEATURES: Record<string, AIFeatureInfo> = {
  "wb-what-exists": {
    id: "wb-what-exists",
    label: "Brainstorm What Exists",
    type: "ai",
    shortDescription: "What would logically exist at this location?",
    fullDescription:
      "Brainstorms what built structures, natural environment, and cultural presence would logically exist at a location given its established properties and world rules.",
    contextSources: [
      "Location details (climate, terrain, culture links)",
      "World systems",
      "Connected cultures",
    ],
    backendFeatureId: "what-exists",
  },
  "wb-location-suggest": {
    id: "wb-location-suggest",
    label: "Suggest Location Elements",
    type: "ai",
    shortDescription: "Creature, flora, and naming ideas for this location",
    fullDescription:
      "Suggests directions for creature types, flora, and naming patterns appropriate to this location's established atmosphere and world rules.",
    contextSources: ["Location details", "World systems", "Connected cultures & eras"],
    backendFeatureId: "element-suggest",
  },
  "wb-culture-suggest": {
    id: "wb-culture-suggest",
    label: "Suggest Cultural Elements",
    type: "ai",
    shortDescription: "Naming, ritual, and aesthetic directions for this culture",
    fullDescription:
      "Brainstorms naming directions, ritual and custom ideas, and aesthetic/material culture directions grounded in this culture's existing profile.",
    contextSources: [
      "Culture details (values, traditions, language family)",
      "Associated world systems",
      "Locations",
    ],
    backendFeatureId: "element-suggest",
  },
  "wb-implications": {
    id: "wb-implications",
    label: "Trace Present-Day Effects",
    type: "ai",
    shortDescription: "What are the present-day ripples of this historical event?",
    fullDescription:
      "Analyzes a historical event to surface its present-day effects — physical remnants, cultural legacy, political consequences, and inherited attitudes.",
    contextSources: ["Historical event details", "Era context", "Associated cultures and world systems"],
    backendFeatureId: "historical-implications",
  },
  "wb-system": {
    id: "wb-system",
    label: "Analyze Edge Cases",
    type: "ai",
    shortDescription: "Edge cases and story implications for a world system",
    fullDescription:
      "Analyzes a magic, technology, or social system to surface edge cases, story implications, and consistency questions the author should resolve.",
    contextSources: ["System rules and description", "Other world systems", "Cultures that use it"],
    backendFeatureId: "system-analysis",
  },
  "wb-calendar": {
    id: "wb-calendar",
    label: "Suggest Special Days",
    type: "ai",
    shortDescription: "Festival, seasonal, and historical day ideas for a calendar",
    fullDescription:
      "Suggests culturally appropriate festivals, seasonal events, and historical observances for a calendar based on the associated culture and history.",
    contextSources: ["Calendar structure", "Associated cultures", "Historical events"],
    backendFeatureId: "calendar-suggestions",
  },
  "wb-travel": {
    id: "wb-travel",
    label: "Analyze Travel Route",
    type: "ai",
    shortDescription: "Hazards, cultural tensions, and story potential of a route",
    fullDescription:
      "Analyzes a travel route between two locations for hazards, cultural tensions, terrain challenges, and narrative opportunities.",
    contextSources: [
      "Origin and destination locations",
      "World systems affecting the route",
      "Cultures along the way",
    ],
    backendFeatureId: "travel-analysis",
  },
};
