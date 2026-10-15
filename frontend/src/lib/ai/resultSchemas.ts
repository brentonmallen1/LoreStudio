import {
  Home,
  Leaf,
  Users,
  HelpCircle,
  Bug,
  Type,
  Star,
  Palette,
  Landmark,
  BookOpen,
  Shield,
  AlertCircle,
  Lightbulb,
  AlertTriangle,
  PartyPopper,
  Sun,
  Clock,
  Navigation,
} from "lucide-react";
import type { SectionConfig } from "../../components/ai/StructuredResponseRenderer";

/**
 * How each worldbuilding answer is laid out, keyed by the backend feature id
 * (services/llm/features.py), so the sheet that asked and the Chronicle that keeps the call
 * show it alike. element-suggest answers in a location's shape or a culture's: its key carries
 * the call's `element_type`.
 */
const WHAT_EXISTS: SectionConfig[] = [
  {
    key: "built_environment",
    label: "Built environment",
    icon: Home,
    color: "var(--color-accent)",
    type: "list",
  },
  {
    key: "natural_environment",
    label: "Natural environment",
    icon: Leaf,
    color: "var(--segment-beat)",
    type: "list",
  },
  {
    key: "cultural_presence",
    label: "Cultural presence",
    icon: Users,
    color: "var(--segment-part)",
    type: "list",
  },
  {
    key: "questions",
    label: "Questions to consider",
    icon: HelpCircle,
    color: "var(--color-ai)",
    type: "list",
  },
];

const LOCATION_ELEMENTS: SectionConfig[] = [
  {
    key: "creature_directions",
    label: "Creature & wildlife directions",
    icon: Bug,
    color: "var(--segment-beat)",
    type: "list",
  },
  {
    key: "flora_directions",
    label: "Flora & environment directions",
    icon: Leaf,
    color: "var(--color-accent)",
    type: "list",
  },
  {
    key: "naming_directions",
    label: "Naming directions",
    icon: Type,
    color: "var(--color-warning)",
    type: "list",
  },
  {
    key: "questions",
    label: "Questions to consider",
    icon: HelpCircle,
    color: "var(--color-ai)",
    type: "list",
  },
];

const CULTURE_ELEMENTS: SectionConfig[] = [
  {
    key: "naming_directions",
    label: "Naming directions",
    icon: Type,
    color: "var(--color-accent)",
    type: "list",
  },
  {
    key: "ritual_directions",
    label: "Ritual & custom directions",
    icon: Star,
    color: "var(--segment-part)",
    type: "list",
  },
  {
    key: "aesthetic_directions",
    label: "Aesthetic & material directions",
    icon: Palette,
    color: "var(--color-warning)",
    type: "list",
  },
  {
    key: "questions",
    label: "Questions to consider",
    icon: HelpCircle,
    color: "var(--color-ai)",
    type: "list",
  },
];

const HISTORICAL_IMPLICATIONS: SectionConfig[] = [
  {
    key: "physical_remnants",
    label: "Physical remnants",
    icon: Landmark,
    color: "var(--color-accent)",
    type: "list",
  },
  {
    key: "cultural_legacy",
    label: "Cultural legacy",
    icon: BookOpen,
    color: "var(--segment-part)",
    type: "list",
  },
  {
    key: "political_effects",
    label: "Political effects",
    icon: Shield,
    color: "var(--color-warning)",
    type: "list",
  },
  {
    key: "questions",
    label: "Questions to consider",
    icon: HelpCircle,
    color: "var(--color-ai)",
    type: "list",
  },
];

const SYSTEM_ANALYSIS: SectionConfig[] = [
  {
    key: "edge_cases",
    label: "Edge cases",
    icon: AlertCircle,
    color: "var(--color-accent)",
    type: "list",
  },
  {
    key: "story_implications",
    label: "Story implications",
    icon: Lightbulb,
    color: "var(--segment-part)",
    type: "list",
  },
  {
    key: "consistency_questions",
    label: "Consistency questions",
    icon: AlertTriangle,
    color: "var(--color-warning)",
    type: "list",
  },
  {
    key: "questions",
    label: "Questions to consider",
    icon: HelpCircle,
    color: "var(--color-ai)",
    type: "list",
  },
];

const CALENDAR_SUGGESTIONS: SectionConfig[] = [
  {
    key: "festivals",
    label: "Festivals & celebrations",
    icon: PartyPopper,
    color: "var(--color-accent)",
    type: "list",
  },
  {
    key: "seasonal_events",
    label: "Seasonal events",
    icon: Sun,
    color: "var(--segment-part)",
    type: "list",
  },
  {
    key: "historical_observances",
    label: "Historical observances",
    icon: Clock,
    color: "var(--color-warning)",
    type: "list",
  },
  {
    key: "questions",
    label: "Questions to consider",
    icon: HelpCircle,
    color: "var(--color-ai)",
    type: "list",
  },
];

const TRAVEL_ANALYSIS: SectionConfig[] = [
  {
    key: "journey_considerations",
    label: "Journey considerations",
    icon: Navigation,
    color: "var(--color-accent)",
    type: "list",
  },
  {
    key: "hazards_and_challenges",
    label: "Hazards & challenges",
    icon: AlertTriangle,
    color: "var(--color-warning)",
    type: "list",
  },
  {
    key: "narrative_possibilities",
    label: "Narrative possibilities",
    icon: BookOpen,
    color: "var(--color-ai)",
    type: "list",
  },
  {
    key: "questions",
    label: "Questions to consider",
    icon: HelpCircle,
    color: "var(--segment-part)",
    type: "list",
  },
];

export const RESULT_SCHEMAS: Record<string, SectionConfig[]> = {
  "what-exists": WHAT_EXISTS,
  "element-suggest:location": LOCATION_ELEMENTS,
  "element-suggest:culture": CULTURE_ELEMENTS,
  "historical-implications": HISTORICAL_IMPLICATIONS,
  "system-analysis": SYSTEM_ANALYSIS,
  "calendar-suggestions": CALENDAR_SUGGESTIONS,
  "travel-analysis": TRAVEL_ANALYSIS,
};

/** The layout for a call's answer, or null when the feature has none (show it as it came). */
export function resultSchema(feature: string, elementType?: string | null): SectionConfig[] | null {
  return (
    RESULT_SCHEMAS[elementType ? `${feature}:${elementType}` : feature] ?? RESULT_SCHEMAS[feature] ?? null
  );
}
