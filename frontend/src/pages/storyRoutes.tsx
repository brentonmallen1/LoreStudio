import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { ROUTE_ELEMENTS } from "./routeElements";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import ModeGate from "../components/layout/ModeGate";
import { findNode } from "../components/layout/structureTreeMeta";
import { sceneToResume } from "../lib/resumeScene";
import SessionLauncher from "./SessionLauncher";
import { STORY_REDIRECTS, STORY_ROUTES, fillParams } from "../lib/routes";
import { useStoryStore } from "../stores/storyStore";
import { useUIStore } from "../stores/uiStore";
import SectionedPage from "./SectionedPage";
import WriteNodePage from "./WriteNodePage";
import styles from "./StoryWorkspace.module.css";

/**
 * The story's pages, generated from `lib/routes.ts` (refactor doc 11, phase 4). One list
 * feeds the palette, the More menu and the routes, so a page cannot be listed and
 * unreachable, or reachable and unlisted; `storyRoutes.test.ts` fails if an id here is
 * missing from the table below. Component imports stay out of `lib/routes.ts` so the
 * Writer bundle and the coverage test never import a page.
 */
const SummaryOverviewView = lazy(() => import("../components/story/SummaryOverviewView"));
const StoryboardView = lazy(() => import("../components/story/StoryboardView"));
const TodoListView = lazy(() => import("../components/story/TodoListView"));
const ManuscriptView = lazy(() => import("../components/manuscript/ManuscriptView"));

/** `/write` with no node: the alternate views, else the node already open or the one to resume. */
function WriteIndex({ storyId }: { storyId: string }) {
  const navigate = useNavigate();
  const { viewMode, setViewMode } = useUIStore();
  const { activeNode, structure } = useStoryStore();
  const SceneEditor = ROUTE_ELEMENTS.write as LazyExoticComponent<ComponentType>;
  if (viewMode === "storyboard") return <StoryboardView />;
  if (viewMode === "summary") return <SummaryOverviewView />;
  if (viewMode === "todos") return <TodoListView />;
  if (viewMode === "manuscript") {
    return (
      <ManuscriptView
        storyId={storyId}
        onNavigateToScene={(id) => {
          setViewMode("tree");
          navigate(`/stories/${storyId}/write/${id}`);
        }}
      />
    );
  }
  const target =
    activeNode && activeNode.story_id === storyId && findNode(structure, activeNode.id)
      ? activeNode
      : sceneToResume(storyId, structure, null);
  // The URL names the open node (doc 11 P3): the strip, breadcrumb and links agree.
  if (target) return <Navigate to={`/stories/${storyId}/write/${target.id}`} replace />;
  return <SceneEditor />;
}

/** An old address that moved into a grouped page (doc 12 P1): params, query and state carry over. */
function MovedTo({ to }: { to: string }) {
  const params = useParams();
  const { search, hash, state } = useLocation();
  return (
    <Navigate
      to={`/stories/${params.storyId}${fillParams(to, params)}${search}${hash}`}
      state={state}
      replace
    />
  );
}

function OutlineRedirect({ storyId }: { storyId: string }) {
  const { search } = useLocation();
  // The Outline page became Plan; old links (?tab=<outline id>) open its beat boards.
  return <Navigate to={`/stories/${storyId}/plan${search}`} replace />;
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
      <Route path="/overview" element={<Navigate to={`/stories/${storyId}`} replace />} />
      <Route path="/write/:nodeId" element={<WriteNodePage />} />
      {STORY_REDIRECTS.map(({ from, to }) => (
        <Route key={from} path={from} element={<MovedTo to={to} />} />
      ))}
      <Route path="/outline" element={<OutlineRedirect storyId={storyId} />} />
      {/* Conversations now, not pages (doc 12 P6). */}
      <Route path="/whatif" element={<SessionLauncher storyId={storyId} type="whatif" />} />
      <Route path="/panels" element={<SessionLauncher storyId={storyId} type="panel" />} />
      <Route path="*" element={<div className={styles.loading}>There is no page here.</div>} />
    </Routes>
  );
}
