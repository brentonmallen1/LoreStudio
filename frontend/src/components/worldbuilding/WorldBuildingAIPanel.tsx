import { useState, useRef, useEffect } from "react";
import { Orbit, X, RefreshCw } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import type { WorldBuildingAIContext } from "../../stores/uiStore";
import { api } from "../../api/client";
import type { StructuredResult } from "../../types";
import StructuredResponseRenderer, { type SectionConfig } from "../ai/StructuredResponseRenderer";
import { RESULT_SCHEMAS } from "../../lib/ai/resultSchemas";
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
    schema: RESULT_SCHEMAS["what-exists"],
    call: (ctx) => api.analyzeLocationExistence(ctx.storyId, ctx.entityId),
  },
  "location-suggest": {
    title: "Suggest Location Elements",
    subtitle: "Generates: Creature Ideas · Flora Ideas · Naming Patterns · Questions",
    schema: RESULT_SCHEMAS["element-suggest:location"],
    call: (ctx) => api.suggestWorldElements(ctx.storyId, "location", ctx.entityId),
  },
  "culture-suggest": {
    title: "Suggest Cultural Elements",
    subtitle: "Generates: Naming Patterns · Rituals & Customs · Aesthetics · Questions",
    schema: RESULT_SCHEMAS["element-suggest:culture"],
    call: (ctx) => api.suggestWorldElements(ctx.storyId, "culture", ctx.entityId),
  },
  implications: {
    title: "Trace Present-Day Effects",
    subtitle: "Generates: Physical remnants · Cultural legacy · Political effects · Questions",
    schema: RESULT_SCHEMAS["historical-implications"],
    call: (ctx) => api.analyzeHistoricalImplications(ctx.storyId, ctx.entityId),
  },
  system: {
    title: "Analyze Edge Cases",
    subtitle: "Generates: Edge cases · Story implications · Consistency questions",
    schema: RESULT_SCHEMAS["system-analysis"],
    call: (ctx) => api.analyzeWorldSystem(ctx.storyId, ctx.entityId),
  },
  calendar: {
    title: "Suggest Special Days",
    subtitle: "Generates: Festivals · Seasonal events · Historical observances · Questions",
    schema: RESULT_SCHEMAS["calendar-suggestions"],
    call: (ctx) => api.suggestCalendarEvents(ctx.storyId, ctx.entityId),
  },
  travel: {
    title: "Analyze Route",
    subtitle:
      "Generates: Journey considerations · Hazards & challenges · Narrative possibilities · Questions",
    schema: RESULT_SCHEMAS["travel-analysis"],
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
            <Orbit size={13} className={styles.headerIcon} />
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
