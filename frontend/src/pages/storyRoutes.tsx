import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { ROUTE_ELEMENTS } from "./routeElements";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import ModeGate from "../components/layout/ModeGate";
import { findNode } from "../components/layout/structureTreeMeta";
import { sceneToResume } from "../lib/resumeScene";
import { STORY_REDIRECTS, STORY_ROUTES } from "../lib/routes";
import { useStoryStore } from "../stores/storyStore";
import SectionedPage from "./SectionedPage";
import WriteNodePage from "./WriteNodePage";
import styles from "./StoryWorkspace.module.css";

// Every field of one scene (doc 24 D19), loaded when first opened.
const SceneSheetPage = lazy(() => import("./SceneSheetPage"));

/**
 * The story's pages, generated from `lib/routes.ts` (refactor doc 11, phase 4). One list
 * feeds the palette, the logo menu and the routes, so a page cannot be listed and
 * unreachable, or reachable and unlisted; `storyRoutes.test.ts` fails if an id here is
 * missing from the table below. Component imports stay out of `lib/routes.ts` so the
 * Writer bundle and the coverage test never import a page.
 */
/** An address that moved: the same entry at its new home. */
function Moved({ storyId, to }: { storyId: string; to: string }) {
  const { "*": rest } = useParams();
  return <Navigate to={`/stories/${storyId}${to}${rest ? `/${rest}` : ""}`} replace />;
}

/**
 * `/write` with no node: the node already open or the one to resume. Storyboard, Summaries
 * and Manuscript were views of this address behind the strip's select; they are pages of
 * their own now (doc 24 D12), so Write only ever means the prose.
 */
function WriteIndex({ storyId }: { storyId: string }) {
  const { activeNode, structure } = useStoryStore();
  const SceneEditor = ROUTE_ELEMENTS.write as LazyExoticComponent<ComponentType>;
  const target =
    activeNode && activeNode.story_id === storyId && findNode(structure, activeNode.id)
      ? activeNode
      : sceneToResume(storyId, structure, null);
  // The URL names the open node (doc 11 P3): the strip, breadcrumb and links agree.
  if (target) return <Navigate to={`/stories/${storyId}/write/${target.id}`} replace />;
  return <SceneEditor />;
}

export default function StoryRoutes() {
  const { storyId } = useParams<{ storyId: string }>();
  if (!storyId) return null;
  return (
    <Routes>
      {STORY_ROUTES.map((route) => {
        if (route.sections) {
          return (
            <Route
              key={route.id}
              path={`${route.path}/*`}
              element={<SectionedPage route={route} storyId={storyId} />}
            />
          );
        }
        const Page = ROUTE_ELEMENTS[route.id] as LazyExoticComponent<ComponentType<{ storyId: string }>>;
        const element =
          route.id === "write" ? (
            <WriteIndex storyId={storyId} />
          ) : route.modes.length < 2 || route.ai ? (
            <ModeGate route={route}>
              <Page storyId={storyId} />
            </ModeGate>
          ) : (
            <Page storyId={storyId} />
          );
        return <Route key={route.id} path={route.path || "/"} element={element} />;
      })}
      {Object.entries(STORY_REDIRECTS).map(([from, to]) => (
        <Route key={from} path={`${from}/*`} element={<Moved storyId={storyId} to={to} />} />
      ))}
      <Route path="/write/:nodeId" element={<WriteNodePage />} />
      <Route
        path="/write/:nodeId/sheet"
        element={
          <Suspense fallback={<div className={styles.loading}>Loading…</div>}>
            <SceneSheetPage />
          </Suspense>
        }
      />
      <Route path="*" element={<div className={styles.loading}>There is no page here.</div>} />
    </Routes>
  );
}
