import { useInPanelPage } from "../panel/inPanelPage";
import StoryboardList from "./StoryboardList";
import StoryboardView from "./StoryboardView";

/**
 * The Storyboard page (doc 24 D12): the board of cards, or, beside the prose, its narrow
 * layout (doc 24 D2), the scenes as cards down the panel under their chapters. A canvas
 * squeezed into a panel is a smaller canvas; the list is what a board is for at that width.
 */
export default function StoryboardPage() {
  return useInPanelPage() ? <StoryboardList /> : <StoryboardView />;
}
