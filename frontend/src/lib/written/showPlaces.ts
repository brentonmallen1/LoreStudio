import { navigateTo } from "../navigation";
import { useEditorBridge } from "../../stores/editorBridge";
import type { SplitOffer } from "../../types/written";

/** Show where a long scene's time jumps: the scene opens with each place lit and the cursor at the first. */
export function showThePlaces(storyId: string, offer: SplitOffer) {
  useEditorBridge
    .getState()
    .showPassage({ nodeId: offer.node_id, passages: offer.jumps.map((j) => j.passage) });
  navigateTo(`/stories/${storyId}/write/${offer.node_id}`);
}
