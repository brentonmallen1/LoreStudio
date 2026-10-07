/** Settings › AI (moved out of types/index.ts, which is on the size debt list). */

export interface AISettings {
  /** The master switch: off hides every AI surface and the backend refuses calls. */
  enabled: boolean;
  jobs_cooldown_seconds: number;
  /** The model answers several calls at once: replies stop no job, and there is no cool-down. */
  model_parallel: boolean;
  core_prompt: string;
  core_prompt_is_custom: boolean;
  feature_prompts: Record<string, string | null>;
}

export interface AISettingsDefaults {
  core_prompt: string;
  feature_labels: Record<string, string>;
  feature_defaults: Record<string, string>;
  /** feature id -> co-author class, so a prompt card can say what it may return. */
  feature_classes: Record<string, string>;
}

export interface AISettingsUpdate {
  enabled?: boolean;
  jobs_cooldown_seconds?: number;
  model_parallel?: boolean;
  core_prompt?: string | null;
  feature_prompts?: Record<string, string | null> | null;
}
