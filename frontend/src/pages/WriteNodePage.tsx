import { lazy, Suspense, useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { findNode } from "../components/layout/structureTreeMeta";
import { useStoryStore } from "../stores/storyStore";
import ContainerNodePage from "./ContainerNodePage";
import styles from "./StoryWorkspace.module.css";

const SceneEditor = lazy(() => import("../components/editor/SceneEditor"));

/**
 * `/write/:nodeId` (refactor doc 11, phase 3): a scene opens in the editor, an act or a
 * chapter on its own plan page. The URL is the source of truth for what is open, so the
 * strip, the breadcrumb, the palette and a pasted link all agree.
 */
export default function WriteNodePage() {
  const { storyId, nodeId } = useParams<{ storyId: string; nodeId: string }>();
  const { structure, activeNode, setActiveNode, activeTemplate } = useStoryStore();
  const node = nodeId ? findNode(structure, nodeId) : undefined;

  useEffect(() => {
    if (node && activeNode?.id !== node.id) setActiveNode(node);
  }, [node?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!node) return <Navigate to={`/stories/${storyId}/write`} replace />;
  const leafLevel = activeTemplate && !activeTemplate.flat ? activeTemplate.levels.length - 1 : 0;
  const isContainer = (node.children?.length ?? 0) > 0 || (node.level < leafLevel && !(node.word_count > 0));
  if (isContainer) return <ContainerNodePage key={node.id} node={node} />;
  if (activeNode?.id !== node.id) return <div className={styles.loading}>Loading…</div>;
  return (
    <Suspense fallback={<div className={styles.loading}>Loading…</div>}>
      <SceneEditor />
    </Suspense>
  );
}
