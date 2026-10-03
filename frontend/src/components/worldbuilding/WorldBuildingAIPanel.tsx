import { useState, useRef, useEffect } from "react";
import { Compass, X, RefreshCw } from "lucide-react";
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
import { useUIStore } from "../../stores/uiStore";
import type { WorldBuildingAIContext } from "../../stores/uiStore";
import { api } from "../../api/client";
import type { StructuredResult } from "../../types";
import StructuredResponseRenderer, { type SectionConfig } from "../ai/StructuredResponseRenderer";
import styles from "./WorldBuildingAIPanel.module.css";
import { useAIAvailable } from "../../lib/mode";

interface FeatureConfig {
  title: string;
  subtitle: string;
  schema: SectionConfig[];
  call: (ctx: WorldBuildingAIContext) => Promise<StructuredResult>;
}

const FEATURE_CONFIGS: Record<WorldBuildingAIContext["feature"], FeatureConfig> = {
  "what-exists": {
    title: "Brainstorm What Exists",
    subtitle: "Generates: Built environment · Natural environment · Cultural presence · Questions",
    schema: [
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
    ],
    call: (ctx) => api.analyzeLocationExistence(ctx.storyId, ctx.entityId),
  },
  "location-suggest": {
    title: "Suggest Location Elements",
    subtitle: "Generates: Creature Ideas · Flora Ideas · Naming Patterns · Questions",
    schema: [
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
    ],
    call: (ctx) => api.suggestWorldElements(ctx.storyId, "location", ctx.entityId),
  },
  "culture-suggest": {
    title: "Suggest Cultural Elements",
    subtitle: "Generates: Naming Patterns · Rituals & Customs · Aesthetics · Questions",
    schema: [
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
    ],
    call: (ctx) => api.suggestWorldElements(ctx.storyId, "culture", ctx.entityId),
  },
  implications: {
    title: "Trace Present-Day Effects",
    subtitle: "Generates: Physical remnants · Cultural legacy · Political effects · Questions",
    schema: [
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
    ],
    call: (ctx) => api.analyzeHistoricalImplications(ctx.storyId, ctx.entityId),
  },
  system: {
    title: "Analyze Edge Cases",
    subtitle: "Generates: Edge cases · Story implications · Consistency questions",
    schema: [
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
    ],
    call: (ctx) => api.analyzeWorldSystem(ctx.storyId, ctx.entityId),
  },
  calendar: {
    title: "Suggest Special Days",
    subtitle: "Generates: Festivals · Seasonal events · Historical observances · Questions",
    schema: [
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
    ],
    call: (ctx) => api.suggestCalendarEvents(ctx.storyId, ctx.entityId),
  },
  travel: {
    title: "Analyze Route",
    subtitle:
      "Generates: Journey considerations · Hazards & challenges · Narrative possibilities · Questions",
    schema: [
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
    ],
    call: (ctx) => api.analyzeTravelRoute(ctx.storyId, ctx.entityId),
  },
};

export default function WorldBuildingAIPanel() {
  // Writer mode renders no AI affordance at all, and the master switch is a promise, not a
  // preference. This whole component is one, so it renders nothing rather than something dead.
  const aiAvailable = useAIAvailable();
  const { worldBuildingAIContext, closeWorldBuildingAIPanel } = useUIStore();
  const [panelWidth, setPanelWidth] = useState(380);
  const [result, setResult] = useState<StructuredResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(380);
  const lastContextKey = useRef<string | null>(null);

  const ctx = worldBuildingAIContext;
  const config = ctx ? FEATURE_CONFIGS[ctx.feature] : null;

  // Auto-run when context changes
  useEffect(() => {
    if (!ctx || !config) return;
    const key = `${ctx.feature}:${ctx.entityId}`;
    if (key === lastContextKey.current) return;
    lastContextKey.current = key;
    run(ctx, config);
  }, [ctx?.feature, ctx?.entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(context: WorldBuildingAIContext, cfg: FeatureConfig) {
    setResult(null);
    setError(null);
    setGenerating(true);
    try {
      const r = await cfg.call(context);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error running analysis.");
    } finally {
      setGenerating(false);
    }
  }

  function rerun() {
    if (!ctx || !config) return;
    run(ctx, config);
  }

  function startResize(e: React.MouseEvent) {
    isResizing.current = true;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = panelWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const dx = resizeStartX.current - ev.clientX;
      setPanelWidth(Math.max(300, Math.min(600, resizeStartWidth.current + dx)));
    };
    const onUp = () => {
      isResizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  if (!ctx || !config) return null;

  if (!aiAvailable) return null;

  return (
    <div className={styles.panel} style={{ width: panelWidth }}>
      <div className={styles.resizeHandle} onMouseDown={startResize} />

      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <Compass size={13} className={styles.headerIcon} />
            <span className={styles.headerTitle}>{config.title}</span>
          </div>
          <div className={styles.headerRight}>
            <button
              className={styles.rerunBtn}
              onClick={rerun}
              disabled={generating}
              title="Re-run this analysis"
            >
              <RefreshCw size={10} />
              {generating ? "Thinking…" : "Re-run"}
            </button>
            <button
              className={styles.closeBtn}
              onClick={closeWorldBuildingAIPanel}
              title="Close"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>
        <div className={styles.headerSubtitle}>{config.subtitle}</div>
      </div>

      <div className={styles.body}>
        {generating && (
          <div className={styles.loading}>
            <div className={styles.loadingDot} />
            <div className={styles.loadingDot} />
            <div className={styles.loadingDot} />
            <span>Thinking…</span>
          </div>
        )}
        {error && <div className={styles.error}>⚠ {error}</div>}
        {!generating && result && <StructuredResponseRenderer result={result} schema={config.schema} />}
      </div>
    </div>
  );
}
