import { useState, useRef, useEffect } from "react";
import { Compass, X, RefreshCw } from "lucide-react";
import { Home, Leaf, Users, HelpCircle, Bug, Type, Star, Palette, Landmark, BookOpen, Shield, AlertCircle, Lightbulb, AlertTriangle, PartyPopper, Sun, Clock, Navigation } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import type { WorldBuildingAIContext } from "../../stores/uiStore";
import { api } from "../../api/client";
import type { StructuredResult } from "../../types";
import StructuredResponseRenderer, { type SectionConfig } from "../ai/StructuredResponseRenderer";
import styles from "./WorldBuildingAIPanel.module.css";

interface FeatureConfig {
  title: string;
  subtitle: string;
  schema: SectionConfig[];
  call: (ctx: WorldBuildingAIContext) => Promise<StructuredResult>;
}

const FEATURE_CONFIGS: Record<WorldBuildingAIContext["feature"], FeatureConfig> = {
  "what-exists": {
    title: "Brainstorm What Exists",
    subtitle: "Generates: Built Environment · Natural Environment · Cultural Presence · Questions",
    schema: [
      { key: "built_environment",  label: "Built Environment",  icon: Home,       color: "var(--color-accent)",   type: "list" },
      { key: "natural_environment", label: "Natural Environment", icon: Leaf,       color: "var(--segment-beat)",   type: "list" },
      { key: "cultural_presence",   label: "Cultural Presence",   icon: Users,      color: "var(--segment-part)",   type: "list" },
      { key: "questions",           label: "Questions to Consider", icon: HelpCircle, color: "var(--color-ai)",     type: "list" },
    ],
    call: (ctx) => api.analyzeLocationExistence(ctx.storyId, ctx.entityId),
  },
  "location-suggest": {
    title: "Suggest Location Elements",
    subtitle: "Generates: Creature Ideas · Flora Ideas · Naming Patterns · Questions",
    schema: [
      { key: "creature_directions", label: "Creature & Wildlife Directions", icon: Bug,        color: "var(--segment-beat)",   type: "list" },
      { key: "flora_directions",    label: "Flora & Environment Directions", icon: Leaf,       color: "var(--color-accent)",   type: "list" },
      { key: "naming_directions",   label: "Naming Directions",              icon: Type,       color: "var(--color-warning)",  type: "list" },
      { key: "questions",           label: "Questions to Consider",          icon: HelpCircle, color: "var(--color-ai)",       type: "list" },
    ],
    call: (ctx) => api.suggestWorldElements(ctx.storyId, "location", ctx.entityId),
  },
  "culture-suggest": {
    title: "Suggest Cultural Elements",
    subtitle: "Generates: Naming Patterns · Rituals & Customs · Aesthetics · Questions",
    schema: [
      { key: "naming_directions",   label: "Naming Directions",              icon: Type,       color: "var(--color-accent)",   type: "list" },
      { key: "ritual_directions",   label: "Ritual & Custom Directions",     icon: Star,       color: "var(--segment-part)",   type: "list" },
      { key: "aesthetic_directions", label: "Aesthetic & Material Directions", icon: Palette,  color: "var(--color-warning)",  type: "list" },
      { key: "questions",           label: "Questions to Consider",          icon: HelpCircle, color: "var(--color-ai)",       type: "list" },
    ],
    call: (ctx) => api.suggestWorldElements(ctx.storyId, "culture", ctx.entityId),
  },
  "implications": {
    title: "Trace Present-Day Effects",
    subtitle: "Generates: Physical Remnants · Cultural Legacy · Political Effects · Questions",
    schema: [
      { key: "physical_remnants",  label: "Physical Remnants",  icon: Landmark,   color: "var(--color-accent)",   type: "list" },
      { key: "cultural_legacy",    label: "Cultural Legacy",    icon: BookOpen,   color: "var(--segment-part)",   type: "list" },
      { key: "political_effects",  label: "Political Effects",  icon: Shield,     color: "var(--color-warning)",  type: "list" },
      { key: "questions",          label: "Questions to Consider", icon: HelpCircle, color: "var(--color-ai)",    type: "list" },
    ],
    call: (ctx) => api.analyzeHistoricalImplications(ctx.storyId, ctx.entityId),
  },
  "system": {
    title: "Analyze Edge Cases",
    subtitle: "Generates: Edge Cases · Story Implications · Consistency Questions",
    schema: [
      { key: "edge_cases",            label: "Edge Cases",              icon: AlertCircle,  color: "var(--color-accent)",  type: "list" },
      { key: "story_implications",    label: "Story Implications",      icon: Lightbulb,    color: "var(--segment-part)",  type: "list" },
      { key: "consistency_questions", label: "Consistency Questions",   icon: AlertTriangle, color: "var(--color-warning)", type: "list" },
      { key: "questions",             label: "Questions to Consider",   icon: HelpCircle,   color: "var(--color-ai)",      type: "list" },
    ],
    call: (ctx) => api.analyzeWorldSystem(ctx.storyId, ctx.entityId),
  },
  "calendar": {
    title: "Suggest Special Days",
    subtitle: "Generates: Festivals · Seasonal Events · Historical Observances · Questions",
    schema: [
      { key: "festivals",              label: "Festivals & Celebrations",  icon: PartyPopper, color: "var(--color-accent)",  type: "list" },
      { key: "seasonal_events",        label: "Seasonal Events",           icon: Sun,         color: "var(--segment-part)",  type: "list" },
      { key: "historical_observances", label: "Historical Observances",    icon: Clock,       color: "var(--color-warning)", type: "list" },
      { key: "questions",              label: "Questions to Consider",     icon: HelpCircle,  color: "var(--color-ai)",      type: "list" },
    ],
    call: (ctx) => api.suggestCalendarEvents(ctx.storyId, ctx.entityId),
  },
  "travel": {
    title: "Analyze Route",
    subtitle: "Generates: Journey Considerations · Hazards & Challenges · Narrative Possibilities · Questions",
    schema: [
      { key: "journey_considerations",  label: "Journey Considerations",   icon: Navigation,    color: "var(--color-accent)",  type: "list" },
      { key: "hazards_and_challenges",  label: "Hazards & Challenges",     icon: AlertTriangle, color: "var(--color-warning)", type: "list" },
      { key: "narrative_possibilities", label: "Narrative Possibilities",  icon: BookOpen,      color: "var(--color-ai)",      type: "list" },
      { key: "questions",               label: "Questions to Consider",    icon: HelpCircle,    color: "var(--segment-part)",  type: "list" },
    ],
    call: (ctx) => api.analyzeTravelRoute(ctx.storyId, ctx.entityId),
  },
};

export default function WorldBuildingAIPanel() {
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
            <button className={styles.closeBtn} onClick={closeWorldBuildingAIPanel} title="Close">
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
        {!generating && result && (
          <StructuredResponseRenderer result={result} schema={config.schema} />
        )}
      </div>
    </div>
  );
}
