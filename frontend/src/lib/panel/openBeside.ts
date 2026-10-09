import { usePanelStore } from "../../stores/panelStore";
import { useStoryStore } from "../../stores/storyStore";
import { navigateTo } from "../navigation";

/**
 * "Open beside the prose" (doc 24 D2), from the logo menu, a page's ⋯ or the palette: the
 * page as a tab in the side panel, and the prose beside it. From another page that means
 * going to the prose, where the panel opens on the page.
 */
export function openBesideTheProse(routeId: string, sectionId?: string): void {
  const story = useStoryStore.getState().activeStory;
  if (!story) return;
  usePanelStore.getState().openPage(routeId, sectionId);
  const { side, frame } = usePanelStore.getState();
  if (side !== "writing" && frame !== "window") navigateTo(`/stories/${story.id}/write`);
}
