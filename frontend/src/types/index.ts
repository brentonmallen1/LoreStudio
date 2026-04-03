export interface User {
  id: string;
  username: string;
  display_name: string;
  is_admin: boolean;
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
  narrative_intent: string;
  premise: string;
  logline: string;
  goals: StoryGoal[];
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
  children: StructureNode[];
}

export interface ArcMilestone {
  id: string;
  text: string;
  completed: boolean;
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

export interface PlotThread {
  id: string;
  story_id: string;
  name: string;
  description: string;
  status: "open" | "developing" | "resolved";
  color: string;
  appearances: PlotThreadAppearance[];
  created_at: string;
  updated_at: string;
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

// ── Scene Chat ──

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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

// ── Story Health ──

export interface PacingEntry {
  id: string;
  title: string;
  word_count: number;
  status: string;
  level_type: string;
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
}

export interface StoryHealth {
  word_count: {
    total: number;
    by_status: Record<string, number>;
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
