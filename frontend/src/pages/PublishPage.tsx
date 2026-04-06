import { useParams, useNavigate } from "react-router-dom";
import { useStoryStore } from "../stores/storyStore";
import { useUIStore } from "../stores/uiStore";
import ManuscriptView from "../components/manuscript/ManuscriptView";

export default function PublishPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { setActiveNode } = useStoryStore();
  const { setViewMode } = useUIStore();

  function handleNavigateToScene(id: string) {
    const { structure } = useStoryStore.getState();
    const queue = [...structure];
    while (queue.length) {
      const n = queue.shift()!;
      if (n.id === id) { setActiveNode(n); break; }
      if (n.children) queue.push(...n.children);
    }
    setViewMode("tree");
    navigate(`/stories/${storyId}/write`);
  }

  if (!storyId) return null;

  return (
    <ManuscriptView
      storyId={storyId}
      onNavigateToScene={handleNavigateToScene}
    />
  );
}
