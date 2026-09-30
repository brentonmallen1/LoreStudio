import { CircleHelp, GitBranch, Lightbulb, MapPin, Users } from "lucide-react";
import type { ToolId } from "../../types/panel";

/** One icon per tool tab, shared by the strip's tool rail and the panel's collapsed rail. */
export const TOOL_ICONS: Record<ToolId, typeof Users> = {
  characters: Users,
  places: MapPin,
  threads: GitBranch,
  ideas: Lightbulb,
  questions: CircleHelp,
};
