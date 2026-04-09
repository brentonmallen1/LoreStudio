export interface User {
  id: string;
  username: string;
  display_name: string;
  is_admin: boolean;
}

export interface Beat {
  id: string;
  name: string;
  position_pct: number;
  description: string;
}

export interface BeatSheet {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  user_id: string | null;
  beats: Beat[];
}

export interface StoryGoal {
  id: string;
  text: string;
  completed: boolean;
}

export interface Story {
  id: string;
  user_id: string;
  title: string;
  description: string;
  intent: string;
  structure_template_id: string;
  genre: string;
  tone: string;
  themes: string[];
  central_conflict: string;
  target_audience: string;
  intended_length: string;
  beat_sheet_id: string | null;
  narrative_intent: string;
  premise: string;
  logline: string;
  goals: StoryGoal[];
  discovery_enabled: boolean;
  discovery_auto_analyze: boolean;
  discovery_element_types: string[];
  discovery_min_confidence: number;
  narrative_perspective: string;
  pov_character_id: string | null;
  created_at: string;
  updated_at: string;
}

export type DiscoveryElementType = "character" | "setting" | "relationship" | "theme" | "object";
export type DiscoveryStatus = "pending" | "approved" | "rejected";

export interface DiscoveredElement {
  id: string;
  story_id: string;
  element_type: DiscoveryElementType;
  name: string;
  description: string;
  confidence: number;
  source_node_id: string | null;
  source_excerpt: string;
  status: DiscoveryStatus;
  merged_to_type: string | null;
  merged_to_id: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface StoryStructureTemplate {
  id: string;
  name: string;
  description: string;
  levels: { name: string; plural: string }[];
  is_system: boolean;
  user_id: string | null;
}

export interface InlineNote {
  id: string;
  anchor: string;
  note: string;
  position: number;
}

export interface SegmentMeta {
  purpose?: string;
  inline_notes?: InlineNote[];
}

export interface StructureNode {
  id: string;
  story_id: string;
  parent_id: string | null;
  level: number;
  level_type: string;
  title: string;
  synopsis: string;
  content: string;
  position: number;
  word_count: number;
  status: "draft" | "revised" | "final";
  metadata_: SegmentMeta;
  entry_state: string;
  exit_state: string;
  key_events: string;
  timeline_position: number | null;
  content_summary: string;
  summary_stale: boolean;
  beat_id: string | null;
  created_at: string;
  updated_at: string;
  children: StructureNode[];
}

export interface ArcMilestone {
  id: string;
  text: string;
  completed: boolean;
  scene_id?: string | null;
  scene_title?: string | null;
}

export interface CharacterAttributes {
  intelligence?: string;
  education?: string;
  moral_alignment?: string;
  disposition?: string;
  temperament?: string;
  social_manner?: string;
}

export interface Character {
  id: string;
  story_id: string;
  name: string;
  role: string;
  personality: string;
  motivation: string;
  background: string;
  appearance: string;
  arc_notes: string;
  interview_prompts: string[];
  traits: Record<string, string>;
  attributes: CharacterAttributes;
  narrative_intent: string;
  narrative_intent_hidden: boolean;
  arc_milestones: ArcMilestone[];
  created_at: string;
  updated_at: string;
}

export interface CharacterRelationship {
  id: string;
  character_id: string;
  related_character_id: string;
  relationship_type: string;
  description: string;
}

export interface Setting {
  id: string;
  story_id: string;
  name: string;
  description: string;
  atmosphere: string;
  history: string;
  significance: string;
  created_at: string;
  updated_at: string;
}

export interface InterviewMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface Interview {
  id: string;
  character_id: string;
  title: string;
  context_node_id: string | null;
  messages: InterviewMessage[];
  interview_notes: string;
  created_at: string;
  updated_at: string;
}

export interface CharacterJourney {
  summary: string;
  is_stale: boolean;
  scene_count: number;
  generated_at: string | null;
}

export interface InterviewSummary {
  id: string;
  character_id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface PanelMessage {
  role: "user" | "panel";
  content: string;
  timestamp: string;
}

export interface PanelInterview {
  id: string;
  story_id: string;
  title: string;
  character_ids: string[];
  messages: PanelMessage[];
  created_at: string;
  updated_at: string;
}

export interface PanelInterviewSummary {
  id: string;
  story_id: string;
  title: string;
  character_ids: string[];
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface PlotThreadAppearance {
  id: string;
  thread_id: string;
  node_id: string;
  note: string;
  created_at: string;
}

export type MICEType = "milieu" | "idea" | "character" | "event";

export type TryFailOutcome = "fail_disaster" | "fail_setback" | "success_cost" | "success_clean";

export interface TryFailCycle {
  id: string;
  description: string;
  outcome: TryFailOutcome;
  node_id: string | null;
}

export interface PlotThread {
  id: string;
  story_id: string;
  name: string;
  description: string;
  status: "open" | "developing" | "resolved";
  color: string;
  mice_type: MICEType | null;
  opens_at_node_id: string | null;
  closes_at_node_id: string | null;
  try_fail_cycles: TryFailCycle[];
  appearances: PlotThreadAppearance[];
  created_at: string;
  updated_at: string;
}

// ── Twists ──

export type TwistType = "reveal" | "reversal" | "identity" | "unreliable_narrator" | "red_herring";
export type TwistStatus = "planned" | "seeding" | "revealed";
export type ClueTarget = "truth" | "misdirection";
export type SubtletyLevel = "obvious" | "moderate" | "subtle" | "hidden";

export interface TwistClue {
  id: string;
  node_id: string | null;
  text: string;
  points_to: ClueTarget;
  subtlety: SubtletyLevel;
}

export interface Twist {
  id: string;
  story_id: string;
  name: string;
  the_truth: string;
  the_misdirection: string;
  twist_type: TwistType;
  status: TwistStatus;
  revealed_at_node_id: string | null;
  clues: TwistClue[];
  created_at: string;
  updated_at: string;
}

// ── Outline ──

export type OutlineBeatType = "plot" | "character" | "theme" | "setting";

export interface OutlineItem {
  id: string;
  story_id: string;
  parent_id: string | null;
  level: number;
  position: number;
  text: string;
  beat_type: OutlineBeatType | null;
  notes: string;
  collapsed: boolean;
  created_at: string;
  updated_at: string;
  children: OutlineItem[];
}

export interface SceneLink {
  id: string;
  story_id: string;
  source_node_id: string;
  target_node_id: string;
  link_type: string;
  note: string;
  created_at: string;
}

export interface SearchResult {
  type: "story" | "character" | "scene" | "setting" | "thread";
  id: string;
  story_id: string;
  title: string;
  subtitle?: string;
  excerpt?: string;
  level_type?: string;
}

// ── LLM Parameters ──

export type ImageTokenBudget = 70 | 140 | 280 | 560 | 1120;

export interface LLMParams {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  thinking_enabled?: boolean;
  image_token_budget?: ImageTokenBudget;
  ollama_url?: string | null;
  ollama_model?: string | null;
}

export interface LLMSettings {
  temperature: number;
  top_p: number;
  top_k: number;
  thinking_enabled: boolean;
  image_token_budget: ImageTokenBudget | null;
  is_default: boolean;
  ollama_url: string | null;
  ollama_model: string | null;
}

// ── Scene Chat ──

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: string[];  // base64-encoded image data for multimodal messages
}

export interface ChatContextPreview {
  story: {
    title: string;
    genre?: string;
    tone?: string;
    themes?: string[];
    narrative_intent?: string;
    logline?: string;
    unresolved_goals?: string[];
  };
  scene: {
    title: string;
    level_type: string;
    synopsis?: string;
    purpose?: string;
    entry_state?: string;
    exit_state?: string;
    key_events?: string;
    word_count: number;
    status: string;
    prose_preview?: string;
  };
  characters_in_scene: { name: string; role: string; motivation?: string }[];
  all_characters: { name: string; role: string; motivation?: string }[];
  settings_in_scene: { name: string; description?: string }[];
  threads_in_scene: { name: string; status: string; description?: string }[];
  open_threads: { name: string; status: string }[];
  sibling_scenes: { title: string; synopsis?: string }[];
}

// ── Brainstorm ──

export interface BrainstormIntent {
  mood?: string;
  goal?: string;
  required_events?: string;
}

// ── Story Health ──

export interface PacingEntry {
  id: string;
  title: string;
  word_count: number;
  status: string;
  level_type: string;
  beat_id: string | null;
}

export interface CharacterHealth {
  id: string;
  name: string;
  role: string;
  scene_appearances: number;
  recent_appearances: number;
  arc_milestones_total: number;
  arc_milestones_done: number;
  arc_pct: number | null;
}

export interface ThreadGroup {
  id: string;
  name: string;
  description: string;
  mice_type: MICEType | null;
  try_fail_cycle_count: number;
}

export interface WordCountTarget {
  min: number | null;
  max: number;
  soft_warning_at: number | null;
  current: number;
  pct: number;
  warning_level: "normal" | "approaching" | "exceeded";
}

export interface MICEViolation {
  thread_id: string;
  thread_name: string;
  message: string;
  conflicting_thread_id: string | null;
  conflicting_thread_name: string | null;
}

export interface StoryHealth {
  intended_length: string;
  word_count: {
    total: number;
    by_status: Record<string, number>;
    target: WordCountTarget | null;
  };
  scenes: {
    total: number;
    by_status: Record<string, number>;
  };
  pacing: PacingEntry[];
  characters: CharacterHealth[];
  absent_characters: string[];
  threads: {
    open: ThreadGroup[];
    developing: ThreadGroup[];
    resolved: ThreadGroup[];
  };
  goals: {
    total: number;
    done: number;
    items: { id: string; text: string; completed: boolean }[];
  };
  mice_violations: MICEViolation[];
}

export interface RecentScene {
  id: string;
  title: string;
  word_count: number;
  status: string;
  level_type: string;
  updated_at: string;
}

export interface RecentActivity {
  event_type: string;
  description: string;
  created_at: string;
}

export interface RecentInterview {
  id: string;
  character_id: string;
  character_name: string;
  title: string;
  updated_at: string;
}

export interface DistributionEntry {
  id: string;
  title: string;
  level_type: string;
  word_count: number;
  scene_count: number;
  pct: number;
}

export interface StoryOverview {
  word_count: number;
  word_count_target: WordCountTarget | null;
  scene_count: number;
  scenes_by_status: Record<string, number>;
  character_count: number;
  thread_counts: Record<string, number>;
  recent_scenes: RecentScene[];
  recent_activity: RecentActivity[];
  recent_interviews: RecentInterview[];
  distribution: DistributionEntry[];
}

// ── Manuscript & Export ──

export interface ManuscriptSection {
  id: string;
  heading: string;
  level: number;
  is_leaf: boolean;
  content: string | null;
  word_count: number;
  status: string;
}

export interface Manuscript {
  title: string;
  total_words: number;
  sections: ManuscriptSection[];
}

export interface ExportOptions {
  format: "docx" | "docx_manuscript" | "epub" | "markdown" | "html" | "odt" | "pdf";
  include_headers: boolean;
  include_scene_titles: boolean;
  title_page: boolean;
  scene_break: string;
  status_filter: string[] | null;
}

export interface AssetAttachment {
  id: string;
  asset_id: string;
  object_type: string;
  object_id: string;
  role: string;
  created_at: string;
}

export interface StoryAsset {
  id: string;
  story_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  alt_text: string;
  description: string;
  created_at: string;
  updated_at: string;
  attachments: AssetAttachment[];
}

export interface DiagramNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: { label: string; [key: string]: unknown };
  style?: Record<string, unknown>;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  animated?: boolean;
}

export interface Diagram {
  id: string;
  story_id: string;
  title: string;
  description: string;
  diagram_type: "mindmap" | "flowchart";
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  attached_node_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiagramSummary {
  id: string;
  story_id: string;
  title: string;
  description: string;
  diagram_type: "mindmap" | "flowchart";
  attached_node_id: string | null;
  created_at: string;
  updated_at: string;
}

// Compendium
export type CompendiumEntryType = "note" | "url" | "document";

export interface CompendiumAttachment {
  id: string;
  entry_id: string;
  object_type: string;
  object_id: string;
  note: string;
  created_at: string;
}

export interface CompendiumEntry {
  id: string;
  story_id: string;
  title: string;
  entry_type: CompendiumEntryType;
  content: string | null;
  url: string | null;
  url_title: string | null;
  url_description: string | null;
  url_fetched_at: string | null;
  asset_id: string | null;
  tags: string[];
  category: string;
  notes: string;
  attachments: CompendiumAttachment[];
  created_at: string;
  updated_at: string;
}

export interface CompendiumEntrySummary {
  id: string;
  story_id: string;
  title: string;
  entry_type: CompendiumEntryType;
  url: string | null;
  url_title: string | null;
  asset_id: string | null;
  tags: string[];
  category: string;
  attachment_count: number;
  created_at: string;
  updated_at: string;
}

// LLM Transparency
export interface PromptPreviewRequest {
  context_type: string;
  story_id?: string;
  node_id?: string;
  interview_id?: string;
  panel_id?: string;
  character_id?: string;
  attribute_type?: string;
  user_message?: string;
}

export interface ContextSource {
  source: string;
  label: string;
  included: boolean;
}

export interface PromptPreview {
  context_type: string;
  system_prompt: string;
  user_message: string;
  model: string;
  sources: ContextSource[];
}

export interface LLMInteractionData {
  preview: PromptPreview;
  response: string;
}

// ── Structured AI Responses ──

export interface StructuredResult {
  success: boolean;
  /** Validated structured data (key → value), present when success=true */
  data?: Record<string, unknown>;
  /** Parsed JSON that failed schema validation, present when JSON was valid but schema wasn't */
  raw_data?: Record<string, unknown>;
  /** Raw LLM response text, always present on failure */
  raw_text?: string;
  tokens_in?: number | null;
  tokens_out?: number | null;
  model?: string;
}

export interface ScenePlanResponse {
  synopsis: string;
  purpose: string;
  entry_state: string;
  exit_state: string;
  key_events: string[];
  characters_to_feature: { name: string; reason: string }[];
  threads_to_advance: { name: string; how: string }[];
}

export interface AnalysisSection {
  summary: string;
  details: string[];
}

export interface EconomyAnalysisResponse {
  thread_balance: AnalysisSection;
  scene_economy: AnalysisSection;
  try_fail_cycles: AnalysisSection;
  recommendations: string[];
}

export interface AttributeSuggestion {
  text: string;
  rationale: string;
}

export interface AttributeSuggestionsResponse {
  suggestions: AttributeSuggestion[];
}

export interface RelationshipSuggestion {
  character_a: string;
  character_b: string;
  relationship_type: string;
  description: string;
}

export interface RelationshipSuggestionsResponse {
  suggestions: RelationshipSuggestion[];
}

// ── Thread Analysis ──

export interface ThreadMomentDiscovery {
  scene_id: string;
  scene_title: string;
  moment_type: string;
  description: string;
  suggested_cycle_link: boolean;
}

export interface ThreadAnalysisResponse {
  progression: AnalysisSection;
  moment_discoveries: ThreadMomentDiscovery[];
  quality: AnalysisSection;
  unlinked_cycles: string[];
  suggestions: string[];
  overall_rating: string;
}

// ── Arc Analysis ──

export interface ArcMomentDiscovery {
  scene_id: string;
  scene_title: string;
  arc_significance: string;
  suggested_milestone_link: string;
}

export interface ArcAnalysisResponse {
  trajectory: AnalysisSection;
  moment_discoveries: ArcMomentDiscovery[];
  drift_analysis: AnalysisSection;
  health: AnalysisSection;
  unlinked_milestones: string[];
  suggestions: string[];
  overall_rating: string;
}

export interface ArcTimelineScene {
  id: string;
  title: string;
  position: number;
  word_count: number;
  status: string;
  linked_milestones: string[];
}

export interface ArcTimelineData {
  character_id: string;
  character_name: string;
  scenes: ArcTimelineScene[];
  milestones: ArcMilestone[];
  appearance_rate: number;
  total_scenes: number;
}

// ── Chronicle ──

export interface ChronicleMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
}

export interface ChronicleSession {
  id: string;
  story_id: string;
  user_id: string;
  context_type: "scene" | "character" | "story" | "panel";
  context_id: string | null;
  context_label: string;
  title: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_preview: string | null;
}

export interface ChronicleSessionDetail extends ChronicleSession {
  messages: ChronicleMessage[];
}

export interface ActivityLog {
  id: string;
  user_id: string;
  story_id: string | null;
  event_type: string;
  category: string;
  description: string;
  starred: boolean;
  metadata_: Record<string, unknown>;
  created_at: string;
}

export interface ChronicleSearchResult {
  type: "session" | "activity";
  session: ChronicleSession | null;
  log: ActivityLog | null;
  excerpt: string;
}

export interface ChronicleStats {
  total_sessions: number;
  total_messages: number;
  total_activity_logs: number;
  sessions_by_type: Record<string, number>;
  ai_interactions: number;
}

export interface AISettings {
  core_prompt: string;
  core_prompt_is_custom: boolean;
  feature_prompts: Record<string, string | null>;
}

export interface AISettingsDefaults {
  core_prompt: string;
  feature_labels: Record<string, string>;
  feature_defaults: Record<string, string>;
}

export interface AISettingsUpdate {
  core_prompt?: string | null;
  feature_prompts?: Record<string, string | null> | null;
}

// ── World Building ──

export interface SceneSetting {
  id: string;
  location_id: string;
  node_id: string;
  role: "primary" | "mentioned" | "flashback" | string;
  notes: string;
  created_at: string;
}

export interface Location {
  id: string;
  story_id: string;
  parent_id: string | null;
  name: string;
  location_type: string;
  climate: string;
  terrain: string;
  political_affiliation: string;
  description: string;
  atmosphere: string;
  history: string;
  significance: string;
  orbital_period: string;
  distance_from_parent: string;
  gravity: string;
  habitability: string;
  radiation_level: string;
  position: number;
  is_stub: boolean;
  discovered_from_id: string | null;
  discovered_at: string | null;
  created_at: string;
  updated_at: string;
  children: Location[];
}

export interface WorldSystem {
  id: string;
  story_id: string;
  name: string;
  system_type: string;
  source_origin: string;
  rules: string;
  limitations: string;
  costs: string;
  hierarchy_tiers: { name: string; description: string; examples: string[] }[];
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Culture {
  id: string;
  story_id: string;
  name: string;
  description: string;
  values: string;
  customs: string;
  taboos: string;
  religion: string;
  government_type: string;
  economy: string;
  social_hierarchy: string;
  naming_conventions: Record<string, unknown>;
  common_phrases: { phrase: string; meaning: string; context: string }[];
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Era {
  id: string;
  story_id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  characteristics: string;
  key_figures: { name: string; role: string }[];
  position: number;
  created_at: string;
  updated_at: string;
}

export interface HistoricalEvent {
  id: string;
  story_id: string;
  era_id: string | null;
  name: string;
  description: string;
  in_world_date: string;
  participants: { type: string; id: string; name: string; role: string }[];
  causes: string;
  consequences: string;
  legacy_effects: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface LocationTravel {
  id: string;
  from_location_id: string;
  to_location_id: string;
  travel_time: string;
  travel_method: string;
  condition: string;
  notes: string;
  bidirectional: boolean;
  created_at: string;
  updated_at: string;
}

export interface Calendar {
  id: string;
  story_id: string;
  name: string;
  description: string;
  months: { name: string; days: number }[];
  days_per_week: number;
  week_day_names: string[];
  special_days: { name: string; month: number; day: number; description: string }[];
  epoch_name: string;
  conversion_notes: string;
  created_at: string;
  updated_at: string;
}

export interface DialogueBlock {
  id: string;
  scene_id: string;
  character_id: string | null;
  speaker_name: string;
  content: string;
  raw_text: string;
  paragraph_index: number;
  position_in_paragraph: number;
  attribution_method: "explicit" | "inferred" | "alternating" | "manual" | "unattributed";
  confidence: number;
  subtext: string | null;
}

export interface DialogueStats {
  total_blocks: number;
  unattributed: number;
  by_character: {
    speaker_name: string;
    character_id: string | null;
    line_count: number;
    word_count: number;
  }[];
}

export interface DialogueInteraction {
  character_a_id: string;
  character_a_name: string;
  character_b_id: string;
  character_b_name: string;
  scene_count: number;
}

export interface DialogueBlockWithScene {
  id: string;
  scene_id: string;
  scene_title: string;
  character_id: string | null;
  speaker_name: string;
  content: string;
  attribution_method: "explicit" | "inferred" | "alternating" | "manual" | "unattributed";
  confidence: number;
  paragraph_index: number;
}

export interface ProposedDialogueTag {
  id: string;
  quote_content: string;
  inferred_speaker: string | null;
  character_id: string | null;
  confidence: number;
  source_excerpt: string;
}

export interface ApplyTagRequest {
  quote_content: string;
  speaker_name: string;
}

export interface ProposedEntityLink {
  id: string;
  entity_type: "character" | "location";
  entity_id: string;
  entity_name: string;
  matched_text: string;
  text_start: number;
  confidence: number;
  source_excerpt: string;
}

export interface ApplyLinkRequest {
  matched_text: string;
  entity_name: string;
  entity_type: "character" | "location";
}

// ---------------------------------------------------------------------------
// Snapshots & Backups
// ---------------------------------------------------------------------------

export interface SnapshotSummary {
  word_count: number;
  scene_count: number;
  character_count: number;
  thread_count: number;
}

export interface SnapshotDeltaSummary {
  word_count_delta: number;
  scenes_added: number;
  scenes_removed: number;
  scenes_modified: number;
  characters_added: number;
  characters_modified: number;
  threads_added: number;
  threads_modified: number;
}

export interface StorySnapshot {
  id: string;
  story_id: string;
  name: string | null;
  trigger: "manual" | "auto";
  snapshot_type: "full" | "delta";
  base_snapshot_id: string | null;
  summary: SnapshotSummary | null;
  delta_summary: SnapshotDeltaSummary | null;
  created_at: string;
}

export interface SnapshotDiffEntity {
  added: Record<string, unknown>[];
  removed: Record<string, unknown>[];
  modified: Record<string, unknown>[];
}

export interface SnapshotDiff {
  word_count_delta: number;
  summary: {
    a: SnapshotSummary;
    b: SnapshotSummary;
  };
  structure_nodes?: SnapshotDiffEntity;
  characters?: SnapshotDiffEntity;
  plot_threads?: SnapshotDiffEntity;
  twists?: SnapshotDiffEntity;
  locations?: SnapshotDiffEntity;
  world_systems?: SnapshotDiffEntity;
  cultures?: SnapshotDiffEntity;
  eras?: SnapshotDiffEntity;
  outline_items?: SnapshotDiffEntity;
}

export type BackupStaleness = "fresh" | "stale" | "overdue";

export interface BackupStatus {
  last_backup_at: string | null;
  last_backup_trigger: "manual" | "auto" | null;
  auto_enabled: boolean;
  interval_minutes: number;
  staleness: BackupStaleness;
  next_auto_at: string | null;
}

export interface BackupSettings {
  id: string;
  story_id: string;
  auto_enabled: boolean;
  interval_minutes: number;
  max_count: number | null;
  max_age_days: number | null;
  last_auto_backup_at: string | null;
  include_diagrams: boolean;
  include_interviews: boolean;
  include_chat_sessions: boolean;
  include_activity_logs: boolean;
  activity_log_limit: number | null;
  include_media_assets: boolean;
}

export interface UserBackupDefaults {
  id: string;
  user_id: string;
  auto_enabled: boolean;
  interval_minutes: number;
  max_count: number | null;
  max_age_days: number | null;
  include_diagrams: boolean;
  include_interviews: boolean;
  include_chat_sessions: boolean;
  include_activity_logs: boolean;
  activity_log_limit: number | null;
  include_media_assets: boolean;
}
