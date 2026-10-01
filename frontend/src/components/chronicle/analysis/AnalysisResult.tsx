import {
  AlignLeft,
  HelpCircle,
  Search,
  FileCheck,
  BarChart3,
  Activity,
  GitMerge,
  Palette,
  Skull,
  ClipboardCheck,
  Repeat2,
  Users,
  UserCheck,
} from "lucide-react";
import type {
  ActivityLog,
  ProseNLPResponse,
  EntitySuggestionsResponse,
  StructuredResult,
  EditorialConsistencyResponse,
} from "../../../types";
import StructuredResponseRenderer from "../../ai/StructuredResponseRenderer";
import { CharacterDimensionalityDisplay, ClicheResultDisplay, VoiceFidelityDisplay } from "./CastResults";
import { EditorialResultDisplay, EntityResultDisplay, ProseResultDisplay } from "./ProseResults";
import { ECONOMY_SCHEMA, PACING_SCHEMA } from "./schemas";
import {
  ContinuityResultDisplay,
  EssentialQuestionsDisplay,
  FirstPassResultDisplay,
  PlotHolesResultDisplay,
  ThemeResultDisplay,
} from "./StoryResults";
import styles from "./Analysis.module.css";

/**
 * One analysis run, read back (doc 12 P4). Story Health used to show these as report
 * cards; the findings feed now carries what they found, and the Chronicle keeps the whole
 * result, drawn here, for any run the author wants to read in full.
 */

// ── Feature metadata ──────────────────────────────────────────────────────────

export const FEATURE_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  "prose-analysis": { label: "Prose Analysis", Icon: AlignLeft, color: "var(--color-nlp)" },
  "editorial-consistency": { label: "Editorial Check", Icon: FileCheck, color: "var(--color-nlp)" },
  "economy-analysis": { label: "Economy Analysis", Icon: BarChart3, color: "var(--color-ai)" },
  "essential-questions": { label: "Story Compass", Icon: HelpCircle, color: "var(--color-ai)" },
  "entity-suggestions": { label: "Lorebook Scan", Icon: Search, color: "var(--color-nlp)" },
  "pacing-analysis": { label: "Pacing Analysis", Icon: Activity, color: "var(--color-ai)" },
  "continuity-check": { label: "Continuity Check", Icon: GitMerge, color: "var(--color-ai)" },
  "theme-tracker": { label: "Theme Tracker", Icon: Palette, color: "var(--color-ai)" },
  "plot-holes": { label: "Plot Holes", Icon: Skull, color: "var(--color-ai)" },
  "first-pass": { label: "First-Pass Editor", Icon: ClipboardCheck, color: "var(--color-ai)" },
  "cliche-analysis": { label: "Cliche Check", Icon: Repeat2, color: "var(--color-ai)" },
  "character-dimensionality": { label: "Character Depth", Icon: Users, color: "var(--color-ai)" },
  "voice-fidelity": { label: "Voice Fidelity", Icon: UserCheck, color: "var(--color-ai)" },
};

export default function AnalysisResult({ log }: { log: ActivityLog }) {
  const feature = log.metadata_?.feature as string;
  const result = log.metadata_?.result;
  if (!result) return <p className={styles.empty}>No result data stored.</p>;

  switch (feature) {
    case "prose-analysis":
      return <ProseResultDisplay result={result as unknown as ProseNLPResponse} />;
    case "editorial-consistency":
      return <EditorialResultDisplay result={result as unknown as EditorialConsistencyResponse} />;
    case "economy-analysis":
      return (
        <StructuredResponseRenderer result={result as unknown as StructuredResult} schema={ECONOMY_SCHEMA} />
      );
    case "pacing-analysis":
      return (
        <StructuredResponseRenderer result={result as unknown as StructuredResult} schema={PACING_SCHEMA} />
      );
    case "essential-questions":
      return <EssentialQuestionsDisplay result={result as unknown as StructuredResult} />;
    case "entity-suggestions":
      return <EntityResultDisplay result={result as unknown as EntitySuggestionsResponse} />;
    case "continuity-check":
      return <ContinuityResultDisplay result={result as unknown as StructuredResult} />;
    case "theme-tracker":
      return <ThemeResultDisplay result={result as unknown as StructuredResult} />;
    case "plot-holes":
      return <PlotHolesResultDisplay result={result as unknown as StructuredResult} />;
    case "first-pass":
      return <FirstPassResultDisplay result={result as unknown as StructuredResult} />;
    case "cliche-analysis":
      return <ClicheResultDisplay result={result as unknown as StructuredResult} />;
    case "character-dimensionality":
      return <CharacterDimensionalityDisplay result={result as unknown as StructuredResult} />;
    case "voice-fidelity":
      return <VoiceFidelityDisplay result={result as unknown as StructuredResult} />;
    default:
      return <p className={styles.empty}>Unknown analysis type.</p>;
  }
}
