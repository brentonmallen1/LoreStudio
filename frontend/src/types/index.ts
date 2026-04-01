export interface User {
  id: string;
  username: string;
  display_name: string;
  is_admin: boolean;
}

export interface Story {
  id: string;
  user_id: string;
  title: string;
  description: string;
  intent: string;
  structure_template_id: string;
  created_at: string;
  updated_at: string;
}

export interface StoryStructureTemplate {
  id: string;
  name: string;
  description: string;
  levels: { name: string; plural: string }[];
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
  created_at: string;
  updated_at: string;
  children: StructureNode[];
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
