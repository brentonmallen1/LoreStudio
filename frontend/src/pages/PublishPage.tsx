import { useParams, useNavigate } from "react-router-dom";
import { useStoryStore } from "../stores/storyStore";
import ManuscriptView from "../components/manuscript/ManuscriptView";

export default function PublishPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { setActiveNode } = useStoryStore();

  function handleNavigateToScene(id: string) {
    const { structure } = useStoryStore.getState();
    const queue = [...structure];
    while (queue.length) {
      const n = queue.shift()!;
      if (n.id === id) {
        setActiveNode(n);
        break;
      }
      if (n.children) queue.push(...n.children);
    }
    navigate(`/stories/${storyId}/write/${id}`);
  }

  if (!storyId) return null;

  return <ManuscriptView storyId={storyId} onNavigateToScene={handleNavigateToScene} asPage />;
}
