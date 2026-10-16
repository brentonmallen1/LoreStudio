import { useLocation } from "react-router-dom";
import { Compass } from "lucide-react";
import type { MenuItem } from "../common/PopoverMenu";
import { navigateTo } from "../../lib/navigation";
import { pageAbout, type RouteSection, type StoryRoute } from "../../lib/routes";
import { routeAt, sectionAt, storyRelative } from "../../lib/panel/pages";
import { useStoryStore } from "../../stores/storyStore";
import { useInPanelPage } from "../panel/inPanelPage";

export interface PageHere {
  route?: StoryRoute;
  section?: RouteSection;
  /** What the page is for, and its guide (doc 30 D2). */
  purpose?: string;
  guide?: string;
  /** Drawn beside the prose in the side panel. */
  inPanel: boolean;
}

/**
 * The story page a header is on, from the window's address or, beside the prose, the page
 * tab's own: its route, its section, and what `lib/routes.ts` says it is for.
 */
export function usePageHere(): PageHere {
  const { pathname } = useLocation();
  const storyId = useStoryStore((s) => s.activeStory?.id);
  const tab = useInPanelPage();
  const rel = tab ? tab.path.replace(/^\/$/, "") : storyId ? storyRelative(storyId, pathname) : null;
  const route = rel === null ? undefined : routeAt(rel);
  if (!route) return { inPanel: Boolean(tab) };
  const section = sectionAt(route, rel ?? "");
  return { route, section, ...pageAbout(route, section), inPanel: Boolean(tab) };
}

/** "How this page works" for a ⋯ menu: the page's guide (doc 30 D2), or null without one. */
export function guideItem(guide: string | undefined): MenuItem | null {
  if (!guide) return null;
  return {
    key: "how-this-page-works",
    label: "How this page works",
    icon: Compass,
    quiet: true,
    onSelect: () => navigateTo(`/guides/${guide}`),
  };
}
