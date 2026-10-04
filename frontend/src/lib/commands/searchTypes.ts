import { BookOpen, Clapperboard, Diamond, GitBranch, MapPin, Users } from "lucide-react";
import type { SearchResult } from "../../types";

/** How the palette draws each kind of search result: its icon and its group's name. */
export const TYPE_ICONS: Record<SearchResult["type"], React.ElementType> = {
  story: BookOpen,
  character: Users,
  scene: Clapperboard,
  setting: MapPin,
  thread: GitBranch,
  twist: Diamond,
};

export const TYPE_LABELS: Record<SearchResult["type"], string> = {
  story: "Stories",
  character: "Characters",
  scene: "Manuscript",
  setting: "Settings",
  thread: "Threads",
  twist: "Twists",
};

/** The order the groups appear in: every type has a place, so none is dropped. */
export const RESULT_ORDER = Object.keys(TYPE_LABELS) as SearchResult["type"][];
