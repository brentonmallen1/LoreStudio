export interface User {
  id: string;
  username: string;
  display_name: string;
  is_admin: boolean;
  settings?: Record<string, unknown>;
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
  author_name: string;
  goals: StoryGoal[];
  discovery_enabled: boolean;
  discovery_auto_analyze: boolean;
  discovery_element_types: string[];
  discovery_min_confidence: number;
  narrative_perspective: string;
  pov_character_id: string | null;
  snowflake_sentence: string;
  snowflake_paragraph: string;
  snowflake_synopsis: string;
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
  /** Top-level titles a new story with this template starts with. */
  starter_outline: string[];
  /** Levels are kinds of beat side by side (Single MICE), all at the top level. */
  flat: boolean;
}

export interface InlineNote {
  id: string;
  anchor: string;
  note: string;
  position: number;
  type?: "author" | "editorial";
  category?: string; // e.g. "fresh-eyes", "priority", "voice", "intent-gap"
  source?: string; // e.g. "editorial-{report_id}"
}

/** Free-form per-segment keys. purpose and inline_notes are columns on StructureNode now. */
export type SegmentMeta = Record<string, unknown>;

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
  purpose: string;
  inline_notes: InlineNote[];
  metadata_: SegmentMeta;
  entry_state: string;
  exit_state: string;
  key_events: string;
  timeline_position: number | null;
  content_summary: string;
  summary_stale: boolean;
  summary_updated_at: string | null;
  beat_id: string | null;
  pov_character_id: string | null;
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

export interface DiscoveryNote {
  id: string;
  text: string;
  scene_id: string | null;
  scene_title: string | null;
  timestamp: string;
  confirmed: boolean;
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
  character_type: string;
  jungian_archetype: string;
  narrative_archetype: string;
  mission_statement: string;
  pronouns: string;
  personality: string;
  motivation: string;
  background: string;
  appearance: string;
  arc_notes: string;
  flaws: string;
  quirks: string;
  speech_patterns: string;
  interview_prompts: string[];
  traits: Record<string, string>;
  attributes: CharacterAttributes;
  narrative_intent: string;
  narrative_intent_hidden: boolean;
  snowflake_summary: string;
  snowflake_synopsis: string;
  arc_milestones: ArcMilestone[];
  discovery_notes: DiscoveryNote[];
  created_at: string;
  updated_at: string;
}

export interface RenamePreviewItem {
  node_id: string;
  node_title: string;
  occurrences: number;
  excerpt: string;
}

export interface RenamePreviewResponse {
  entity_type: string;
  old_name: string;
  new_name: string;
  affected_scenes: RenamePreviewItem[];
  total_occurrences: number;
}

export interface PronounRewriteProposal {
  id: string;
  node_id: string;
  node_title: string;
  original: string;
  rewritten: string;
  explanation: string;
}

export interface PronounRefactorPreviewResponse {
  character_id: string;
  character_name: string;
  old_pronouns: string;
  new_pronouns: string;
  proposals: PronounRewriteProposal[];
  scenes_scanned: number;
}

// ── NLP Prose Analysis ───────────────────────────────────────────────────────

export interface PassageFinding {
  passage: string;
  char_offset: number;
  severity: "info" | "warning" | "issue";
  explanation: string;
  suggestion?: string;
}

export interface PassiveVoiceResult {
  findings: PassageFinding[];
  sentence_count: number;
  passive_count: number;
  percentage: number;
}

export interface AdverbResult {
  findings: PassageFinding[];
  word_count: number;
  adverb_count: number;
  percentage: number;
  threshold: number;
}

export interface SaidBookismResult {
  findings: PassageFinding[];
  total_attributions: number;
  bookism_count: number;
}

export interface RepeatedWordResult {
  findings: PassageFinding[];
  window_chars: number;
}

export interface SentenceLengthBucket {
  label: string;
  count: number;
}

export interface SentenceVarietyResult {
  sentence_count: number;
  mean_length: number;
  std_dev: number;
  min_length: number;
  max_length: number;
  histogram: SentenceLengthBucket[];
  assessment: "monotonous" | "varied" | "erratic" | "too_short" | "";
}

export interface SceneNLPAnalysis {
  scene_id: string;
  scene_title: string;
  word_count: number;
  passive_voice?: PassiveVoiceResult;
  adverb_overuse?: AdverbResult;
  said_bookisms?: SaidBookismResult;
  repeated_words?: RepeatedWordResult;
  sentence_variety?: SentenceVarietyResult;
}

export interface ProseNLPResponse {
  scenes: SceneNLPAnalysis[];
  checks_run: string[];
}

export interface CharacterDialogueProseResult {
  word_count: number;
  line_count: number;
  said_bookisms?: SaidBookismResult;
  sentence_variety?: SentenceVarietyResult;
  adverb_overuse?: AdverbResult;
}

export interface EntitySuggestion {
  text: string;
  label: string;
  scene_count: number;
  occurrences: number;
  scene_ids: string[];
  scene_titles: string[];
}

export interface EntitySuggestionsResponse {
  character_suggestions: EntitySuggestion[];
  location_suggestions: EntitySuggestion[];
}

// ── Editorial Consistency (NLP) ───────────────────────────────────────────────

export interface TenseShift {
  sentence: string;
  char_offset: number;
  dominant_tense: string;
  detected_tense: string;
  severity: string;
}

export interface TenseConsistencyResult {
  findings: TenseShift[];
  dominant_tense: string;
  past_sentence_count: number;
  present_sentence_count: number;
  shift_count: number;
}

export interface POVDriftFinding {
  sentence: string;
  char_offset: number;
  subjects: string[];
  severity: string;
  explanation: string;
}

export interface POVDriftResult {
  findings: POVDriftFinding[];
  dominant_subject: string;
  perspective_subjects: string[];
}

export interface SceneEditorialAnalysis {
  scene_id: string;
  scene_title: string;
  word_count: number;
  tense_consistency: TenseConsistencyResult | null;
  pov_drift: POVDriftResult | null;
}

export interface EditorialConsistencyResponse {
  scenes: SceneEditorialAnalysis[];
  checks_run: string[];
  total_tense_shifts: number;
  total_pov_flags: number;
}

// ── AI Story Analysis Results ─────────────────────────────────────────────────

export interface PacingAnalysisResult {
  act_balance: { summary: string; details: string[] };
  tension_curve: { summary: string; details: string[] };
  slow_spots: string[];
  pacing_strengths: string[];
  recommendations: string[];
  overall_rating: string;
}

export interface ContinuityIssue {
  description: string;
  severity: string;
  scene_references: string[];
  explanation: string;
  suggestion: string;
}

export interface ContinuityCheckResult {
  issues: ContinuityIssue[];
  timeline_notes: string[];
  character_notes: string[];
  summary: string;
  overall_rating: string;
}

export interface ThemeEntry {
  name: string;
  description: string;
  scenes: string[];
  development: string;
  strength: string;
}

export interface ThemeTrackerResult {
  themes: ThemeEntry[];
  motifs: string[];
  thematic_arc: string;
  gaps: string[];
  recommendations: string[];
}

export interface PlotHole {
  description: string;
  severity: string;
  scene_references: string[];
  explanation: string;
  suggestion: string;
}

export interface PlotHoleDetectionResult {
  holes: PlotHole[];
  logic_gaps: string[];
  unanswered_questions: string[];
  summary: string;
  overall_rating: string;
}

export interface StrengthDimensions {
  trust: number;
  power: number;
  affection: number;
  tension: number;
  openness: number;
}

export interface CharacterRelationship {
  id: string;
  character_id: string;
  related_character_id: string;
  relationship_type: string;
  description: string;
  strength: StrengthDimensions;
  visibility: "public" | "hidden";
  narrative_purpose: string[];
  notes: string;
  is_suggested: boolean;
  suggestion_source: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface RelationshipTemplate {
  id: string;
  name: string;
  relationship_type: string;
  default_strength: StrengthDimensions;
  default_narrative_purpose: string[];
  default_visibility: "public" | "hidden";
  description_hint: string;
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

export type {
  CharacterJourney,
  Interview,
  InterviewMessage,
  InterviewSummary,
  InterviewUpdate,
  KnowledgeScope,
} from "./interviews";

export interface PanelMessage {
  role: "user" | "character";
  content: string;
  timestamp: string;
  character_id?: string;
  character_name?: string;
}

export interface PanelSettings {
  max_rounds: number;
}

/** One frame of a panel stream. `thinking` carries reasoning and is not part of the reply. */
export interface PanelStreamEvent {
  event: "start" | "token" | "thinking" | "end" | "pass" | "done";
  character?: string;
  character_id?: string;
  delta?: string;
}

export interface PanelInterview {
  id: string;
  story_id: string;
  title: string;
  character_ids: string[];
  messages: PanelMessage[];
  settings: Partial<PanelSettings>;
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

// ── Reader Knowledge ──

export type KnowledgeType =
  "truth_revealed" | "misdirection_planted" | "clue_planted" | "character_learns" | "reader_only";

export interface ReaderKnowledgeEvent {
  id: string;
  story_id: string;
  node_id: string | null;
  twist_id: string | null;
  knowledge_type: KnowledgeType;
  subject: string;
  detail: string;
  reader_knows: boolean;
  characters_who_know: string[];
  is_truth: boolean;
  supersedes_id: string | null;
  created_at: string;
  updated_at: string;
  // Denormalized
  node_title?: string | null;
  twist_name?: string | null;
}

// ── Todos ──

export interface StoryTodo {
  id: string;
  story_id: string;
  node_id: string | null;
  content: string;
  done: boolean;
  position: number;
  doc_from: number | null;
  doc_to: number | null;
  created_at: string;
  updated_at: string;
  node_title: string | null;
}

// ── Outline ──

export type OutlineBeatType = "plot" | "character" | "theme" | "setting";

export interface Outline {
  id: string;
  story_id: string;
  name: string;
  position: number;
  source_beat_sheet_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutlineWithItems extends Outline {
  items: OutlineItem[];
}

export interface OutlineItem {
  id: string;
  outline_id: string;
  parent_id: string | null;
  level: number;
  position: number;
  text: string;
  beat_type: OutlineBeatType | null;
  notes: string;
  collapsed: boolean;
  scene_id: string | null;
  scene_title: string | null;
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
  /** Only meaningful when saving settings: the user's ceiling on the context window. */
  num_ctx_max?: number | null;
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
  /** Ceiling on the context window, whatever a feature's budget asks for. null = no ceiling. */
  num_ctx_max: number | null;
  is_default: boolean;
  ollama_url: string | null;
  ollama_model: string | null;
  effective_ollama_url: string;
  effective_ollama_model: string;
}

// ── Scene Chat ──

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: string[]; // base64-encoded image data for multimodal messages
  isSummary?: boolean; // true when this message is a conversation summary replacement
  /** The model's reasoning for this answer, delivered on its own event and never part of content. */
  thinking?: string;
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
  character_names: string[];
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
  scene_summaries: {
    total: number;
    fresh: number;
    stale: number;
    missing: number;
    last_updated: string | null;
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
  format: "docx" | "docx_manuscript" | "epub" | "markdown" | "html" | "odt" | "pdf" | "txt";
  include_headers: boolean;
  include_scene_titles: boolean;
  title_page: boolean;
  scene_break: string;
  status_filter: string[] | null;
  pdf_layout?: "default" | "novel" | "manuscript" | "compact" | "dark";
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
  preview: string;
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
  context_options?: ContextOptions;
  /** Summary style, so previewing a detailed summary does not show the brief one. */
  style?: string;
}

export interface ContextSource {
  source: string;
  label: string;
  included: boolean;
}

export interface TokenBreakdown {
  system_prompt: number;
  context: number;
}

export interface ContextOptions {
  include_characters: boolean;
  include_threads: boolean;
  include_settings: boolean;
  include_siblings: boolean;
}

export interface PromptPreview {
  context_type: string;
  system_prompt: string;
  composed_prompt: string;
  user_message: string;
  model: string;
  sources: ContextSource[];
  token_breakdown?: TokenBreakdown;
}

export interface LLMInteractionData {
  /** The call that ran, when one was found (doc 06 §3). */
  callId?: string;
  /** What *would* be sent — the fallback when the feature has not run here yet. */
  preview?: PromptPreview;
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

export interface RelationshipSuggestion {
  character_a: string;
  character_b: string;
  character_a_id: string;
  character_b_id: string;
  relationship_type: string;
  description: string;
  rationale: string;
  narrative_purpose: string[];
  strength_trust: number;
  strength_power: number;
  strength_affection: number;
  strength_tension: number;
  strength_openness: number;
}

export interface RelationshipSuggestionsResult extends StructuredResult {
  data?: { suggestions: RelationshipSuggestion[] };
}

export interface ScenePlanResponse {
  synopsis: string;
  purpose: string;
  entry_state: string;
  exit_state: string;
  key_events: string[];
  characters_to_feature: { name: string; reason: string }[];
  threads_to_advance: { name: string; how: string }[];
  /** What only the author can decide about this scene (doc 06 §5). */
  questions?: string[];
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

// ── Character Unlinked Mentions ──

export interface UnlinkedMentionProposal {
  id: string;
  matched_text: string;
  confidence: number;
  source_excerpt: string;
}

export interface SceneWithUnlinkedMentions {
  scene_id: string;
  scene_title: string;
  proposals: UnlinkedMentionProposal[];
}

export interface CharacterUnlinkedMentionsResponse {
  character_id: string;
  character_name: string;
  total_unlinked: number;
  scenes: SceneWithUnlinkedMentions[];
}

export interface ApplyMentionItem {
  id: string;
  matched_text: string;
}

export interface ApplyMentionsForScene {
  scene_id: string;
  proposals: ApplyMentionItem[];
}

// ── Show Don't Tell Analysis ──

export interface ShowDontTellInstance {
  passage: string;
  severity: "strong" | "moderate" | "subtle";
  issue_type: "emotion" | "state" | "quality" | "exposition";
  explanation: string;
  /** The question that points at the gap. Never a replacement sentence (doc 06 §5). */
  question: string;
}

export interface ShowDontTellAnalysisResponse {
  instances: ShowDontTellInstance[];
  summary: string;
  overall_rating: string;
  strengths: string[];
}

// ── Audience Adherence ──

export interface AudienceIssue {
  passage: string;
  issue_type: "vocabulary" | "content" | "theme" | "pacing" | "tone";
  severity: "critical" | "moderate" | "minor";
  explanation: string;
  suggestion: string;
}

export interface AudienceAdherenceResponse {
  target_audience: string;
  issues: AudienceIssue[];
  vocabulary_assessment: string;
  content_assessment: string;
  theme_assessment: string;
  overall_fit: string;
  summary: string;
}

// ── Cliche Analysis ──

export interface ClicheInstance {
  passage: string;
  cliche_type: "phrase" | "trope" | "character_type" | "plot_device" | "description";
  scene_title: string;
  scene_id: string;
  explanation: string;
  severity: "strong" | "moderate" | "subtle";
  intentional_use_case: string;
}

export interface ClicheCategory {
  name: string;
  count: number;
  instances: ClicheInstance[];
}

export interface ClicheAnalysisResponse {
  categories: ClicheCategory[];
  total_count: number;
  density_note: string;
  genre_context: string;
  summary: string;
  overall_rating: "needs_work" | "fair" | "good" | "excellent";
  strengths: string[];
}

// ── Discovery Questions ──

export interface DiscoveryQuestion {
  question: string;
  context_area: string;
  why_this_matters: string;
}

export interface DiscoveryQuestionsResponse {
  questions: DiscoveryQuestion[];
  focus_area: "character" | "location" | "scene" | "story";
  entity_name: string;
  observation: string;
}

// ── Character Dimensionality ──

export interface CharacterDimensionEntry {
  character_id: string;
  character_name: string;
  role: string;
  dimension_score: "flat" | "developing" | "dimensional" | "complex";
  strengths: string[];
  gaps: string[];
  contradictions: string;
  relationship_depth: string;
  recommendations: string[];
}

export interface CharacterDimensionalityResult {
  characters: CharacterDimensionEntry[];
  cast_balance: string;
  ensemble_dynamics: string;
  summary: string;
  overall_rating: "needs_work" | "fair" | "good" | "excellent";
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
  /** The master switch: off hides every AI surface and the backend refuses calls. */
  enabled: boolean;
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
  attribution_method: "explicit" | "inferred" | "alternating" | "manual" | "unattributed" | "pov_default";
  dialogue_type: "speech" | "thought" | null;
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
  balance_score: number | null; // 0-100, higher = more balanced
  monologue_scenes: {
    scene_id: string;
    dominant_speaker: string;
    pct: number;
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
  attribution_method: "explicit" | "inferred" | "alternating" | "manual" | "unattributed" | "pov_default";
  dialogue_type: "speech" | "thought" | null;
  confidence: number;
  paragraph_index: number;
  subtext?: string | null;
}

export interface CharacterVoiceProfile {
  character_id: string;
  character_name: string;
  total_lines: number;
  vocabulary_size: number;
  vocabulary_richness: number;
  signature_words: string[];
  avg_sentence_length: number;
  question_ratio: number;
  exclamation_ratio: number;
}

export interface VoiceSimilarityPair {
  char_a_id: string;
  char_a_name: string;
  char_b_id: string;
  char_b_name: string;
  similarity_score: number;
  shared_patterns: string[];
}

export interface VoiceDistinctnessResult {
  profiles: CharacterVoiceProfile[];
  similar_pairs: VoiceSimilarityPair[];
  overall_distinctness: "distinct" | "some_overlap" | "homogeneous";
  focus_character_id: string;
}

// ── Voice Fidelity ────────────────────────────────────────────────────────────

export interface VoiceFidelityFinding {
  dialogue_excerpt: string;
  issue_type:
    | "etymology_mismatch"
    | "vocabulary_mismatch"
    | "formality_drift"
    | "education_inconsistency"
    | "manner_conflict"
    | "authentic";
  severity: "issue" | "warning" | "info";
  explanation: string;
  attribute_context: string;
  suggestion: string;
}

export interface VoiceFidelityResult {
  character_name: string;
  attribute_summary: string;
  findings: VoiceFidelityFinding[];
  authentic_examples: string[];
  overall_fidelity: "excellent" | "good" | "fair" | "needs_work";
  summary: string;
  recommendations: string[];
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

export interface SceneWithDialogueProposals {
  scene_id: string;
  scene_title: string;
  proposals: ProposedDialogueTag[];
}

export interface BatchSuggestResponse {
  total_proposals: number;
  scenes: SceneWithDialogueProposals[];
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

// ---------------------------------------------------------------------------
// Document Import Wizard
// ---------------------------------------------------------------------------

export interface ImportPreviewNode {
  id: string;
  parent_id: string | null;
  title: string;
  level: number;
  level_type: string;
  content_preview: string;
  word_count: number;
  source: "heuristic" | "ai" | "user";
  confidence: number;
  needs_review: boolean;
  paragraph_start: number;
  paragraph_end: number;
}

export interface ImportPreviewTree {
  session_id: string;
  source_format: string;
  detected_title: string | null;
  template_id: string;
  template_levels: { name: string; plural: string }[];
  nodes: ImportPreviewNode[];
  warnings: string[];
  total_word_count: number;
}

export interface ImportUploadResponse {
  session_id: string;
  source_format: string;
  detected_title: string | null;
  preview: ImportPreviewTree;
  has_unstructured_blocks: boolean;
  ai_available: boolean;
}

export interface ImportAIAnalyzeResponse {
  preview: ImportPreviewTree;
  suggestions_applied: number;
  reasoning: string;
}

export interface ImportNodeAdjustment {
  action: "rename" | "merge_up" | "split" | "relevel";
  node_id: string;
  new_title?: string;
  split_at_paragraph?: number;
  new_level?: number;
}

export interface ImportFinalizeRequest {
  title: string;
  description: string;
  template_id: string;
  genre: string;
  extraction_candidate_ids?: string[];
  extraction_candidates?: ExtractionCandidate[];
}

// ── Import: Entity Extraction ──────────────────────────────────────────────

export interface ExtractionOptions {
  characters_nlp: boolean;
  locations_nlp: boolean;
  characters_ai: boolean;
  locations_ai: boolean;
  relationships_ai: boolean;
}

export interface AIEnrichOptions {
  characters_ai: boolean;
  locations_ai: boolean;
  relationships_ai: boolean;
}

export interface ExtractedCharacter {
  role: string;
  personality: string;
  motivation: string;
  appearance: string;
  background: string;
  confidence: number;
}

export interface ExtractedLocation {
  location_type: string;
  description: string;
  atmosphere: string;
  significance: string;
  confidence: number;
}

export interface ExtractedRelationship {
  relationship_type: string;
  description: string;
  role_influence: string;
  confidence: number;
}

export interface ExtractionCandidate {
  id: string;
  name: string;
  entity_type: "character" | "location" | "relationship";
  source: "nlp" | "ai";
  occurrences: number;
  scene_count: number;
  confidence: number;
  scene_ids: string[];
  char_a_name?: string;
  char_b_name?: string;
  extracted_character?: ExtractedCharacter;
  extracted_location?: ExtractedLocation;
  extracted_relationship?: ExtractedRelationship;
}

export interface ExtractionPreview {
  candidates: ExtractionCandidate[];
  ai_available: boolean;
  nlp_elapsed_ms: number;
  ai_elapsed_ms: number | null;
}
