import { GitBranch, MapPin, MessageSquare, NotebookPen, StickyNote, Users } from "lucide-react";
import type { ToolId } from "../../types/panel";

/** One icon per tool, for the rail and the + Open… menu. */
export const TOOL_ICONS: Record<ToolId, typeof Users> = {
  characters: Users,
  places: MapPin,
  threads: GitBranch,
  notes: StickyNote,
  freewrite: NotebookPen,
  dialogue: MessageSquare,
};
