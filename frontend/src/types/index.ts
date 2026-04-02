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

export interface SegmentMeta {
  purpose?: string;
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
  messages: InterviewMessage[];
  interview_notes: string;
  created_at: string;
  updated_at: string;
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
