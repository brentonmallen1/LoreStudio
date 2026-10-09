import { useNavigate } from "react-router-dom";
import ManuscriptView from "../components/manuscript/ManuscriptView";
import type { PageProps } from "./routeElements";

/**
 * The book read straight through, with export (doc 24 D12): a page of its own, where it was
 * a view of Write behind the strip's select. A scene's title opens it in the editor.
 */
export default function ManuscriptPage({ storyId }: PageProps) {
  const navigate = useNavigate();
  return (
    <ManuscriptView
      storyId={storyId}
      onNavigateToScene={(id) => navigate(`/stories/${storyId}/write/${id}`)}
    />
  );
}
