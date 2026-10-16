import { useLayoutEffect } from "react";
import { Navigate } from "react-router-dom";
import { useUIStore } from "../stores/uiStore";

/**
 * Logo menu › Outline: where the acts, chapters and scenes are added, renamed and reordered.
 * It is the story strip opened out, so this page only opens it and goes to the prose.
 */
export default function OutlinePage({ storyId }: { storyId: string }) {
  const openOutline = useUIStore((s) => s.openOutline);
  useLayoutEffect(() => openOutline(), [openOutline]);
  return <Navigate to={`/stories/${storyId}/write`} replace />;
}
