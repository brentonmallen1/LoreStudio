import { ListTree } from "lucide-react";
import { sceneLeaves } from "../../lib/planning/methods";
import { EMPTY } from "../../lib/emptyStates";
import { useStoryStore } from "../../stores/storyStore";
import EmptyState from "../common/EmptyState";
import { useInPanelPage } from "../panel/inPanelPage";
import StoryboardList from "./StoryboardList";
import StoryboardView from "./StoryboardView";

/**
 * The Storyboard page (doc 24 D12): the board of cards, or, beside the prose, its narrow
 * layout (doc 24 D2), the scenes as cards down the panel under their chapters. A canvas
 * squeezed into a panel is a smaller canvas; the list is what a board is for at that width.
 * With no scenes yet it says what the board is and where scenes come from (doc 30 D3).
 */
export default function StoryboardPage() {
  const inPanel = useInPanelPage();
  const { activeStory, structure, activeTemplate } = useStoryStore();
  if (activeStory && sceneLeaves(structure, activeTemplate).length === 0)
    return (
      <EmptyState
        copy={EMPTY.storyboard}
        size={inPanel ? "small" : "page"}
        action={{
          label: "Add scenes in the Outline",
          icon: ListTree,
          to: `/stories/${activeStory.id}/outline`,
        }}
      />
    );
  return inPanel ? <StoryboardList /> : <StoryboardView />;
}
