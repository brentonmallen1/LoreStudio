import {
  AlertTriangle,
  BarChart3,
  Activity,
  RefreshCw,
  Lightbulb,
  CheckCircle,
  Star,
  TrendingUp,
  Volume2,
} from "lucide-react";
import type { SectionConfig } from "../../ai/StructuredResponseRenderer";

/** Section layouts for the analyses StructuredResponseRenderer draws as is. */

// ── Economy schema (mirrors EconomyAnalysisPanel) ─────────────────────────────

export const ECONOMY_SCHEMA: SectionConfig[] = [
  { key: "thread_balance", label: "Thread Balance", icon: BarChart3, color: "var(--color-ai)", type: "text" },
  {
    key: "scene_economy",
    label: "Scene Economy",
    icon: Activity,
    color: "var(--color-warning)",
    type: "text",
  },
  {
    key: "try_fail_cycles",
    label: "Try/Fail Cycles",
    icon: RefreshCw,
    color: "var(--segment-part)",
    type: "text",
  },
  {
    key: "recommendations",
    label: "Recommendations",
    icon: Lightbulb,
    color: "var(--segment-beat)",
    type: "list",
  },
];

export const PACING_SCHEMA: SectionConfig[] = [
  { key: "act_balance", label: "Act Balance", icon: BarChart3, color: "var(--color-ai)", type: "text" },
  {
    key: "tension_curve",
    label: "Tension Curve",
    icon: Activity,
    color: "var(--color-warning)",
    type: "text",
  },
  {
    key: "slow_spots",
    label: "Slow Spots",
    icon: AlertTriangle,
    color: "var(--color-warning)",
    type: "list",
  },
  {
    key: "pacing_strengths",
    label: "Strengths",
    icon: CheckCircle,
    color: "var(--color-success)",
    type: "list",
  },
  {
    key: "recommendations",
    label: "Recommendations",
    icon: Lightbulb,
    color: "var(--segment-beat)",
    type: "list",
  },
];

export const FIRST_PASS_SCHEMA: SectionConfig[] = [
  {
    key: "goal_alignment",
    label: "Goal Alignment",
    icon: CheckCircle,
    color: "var(--color-success)",
    type: "text",
  },
  { key: "arc_progress", label: "Arc Progress", icon: TrendingUp, color: "var(--color-ai)", type: "text" },
  {
    key: "tone_consistency",
    label: "Tone Consistency",
    icon: Volume2,
    color: "var(--color-accent)",
    type: "text",
  },
  {
    key: "missed_setups",
    label: "Missed Setups",
    icon: AlertTriangle,
    color: "var(--color-warning)",
    type: "list",
  },
  { key: "strengths", label: "Strengths", icon: Star, color: "var(--color-success)", type: "list" },
  {
    key: "recommendations",
    label: "Recommendations",
    icon: Lightbulb,
    color: "var(--segment-beat)",
    type: "list",
  },
];
