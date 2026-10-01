import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { getSessionType } from "../lib/ai/sessionTypes";
import { useAIAvailable } from "../lib/mode";
import { useAIStore } from "../stores/aiStore";
import { useStoryStore } from "../stores/storyStore";

/**
 * What used to be a page and is a conversation (doc 12 P6): `/whatif` and `/panels` start
 * that session in the Assistant tab and go back to the prose, so old links and bookmarks
 * still do what they did. Where the Assistant is not available they go to the prose alone.
 */
export default function SessionLauncher({ storyId, type }: { storyId: string; type: "whatif" | "panel" }) {
  const aiAvailable = useAIAvailable();
  const started = useRef(false);
  useEffect(() => {
    if (!aiAvailable || started.current) return;
    started.current = true;
    const spec = getSessionType(type);
    const { activeNode } = useStoryStore.getState();
    if (spec)
      void useAIStore
        .getState()
        .createSession(type, spec.getDefaultContext({ storyId, nodeId: activeNode?.id }));
  }, [aiAvailable, storyId, type]);
  return <Navigate to={`/stories/${storyId}/write`} replace />;
}
