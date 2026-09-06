import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation, Routes, Route } from "react-router-dom";
import { api } from "../api/client";
import { useStoryStore } from "../stores/storyStore";
import { useUIStore } from "../stores/uiStore";
import { SHORTCUTS, matchesCombo } from "../lib/keyboard/shortcuts";
import { STORY_ROUTES } from "../lib/routes";
import ModeGate from "../components/layout/ModeGate";

const ROUTE = (id: string) => STORY_ROUTES.find((r) => r.id === id)!;
// Always-loaded layout chrome
import Sidebar from "../components/layout/Sidebar";
import StructureTreePanel from "../components/layout/StructureTreePanel";
import StorySearchPanel from "../components/story/StorySearchPanel";
import styles from "./StoryWorkspace.module.css";

// Lazy-loaded route panels — only fetched when the user navigates to them
const SceneEditor = lazy(() => import("../components/editor/SceneEditor"));
const CharacterSheet = lazy(() => import("../components/characters/CharacterSheet"));
const CharacterList = lazy(() => import("../components/characters/CharacterList"));
const StoryIdentityPanel = lazy(() => import("../components/story/StoryIdentityPanel"));
const CompendiumPanel = lazy(() => import("../components/compendium/CompendiumPanel"));
const WorldBuildingHub = lazy(() => import("../components/worldbuilding/WorldBuildingHub"));
const PanelInterviewPanel = lazy(() => import("../components/panels/PanelInterviewPanel"));
const PlotThreadManager = lazy(() => import("../components/threads/PlotThreadManager"));
const TwistManager = lazy(() => import("../components/twists/TwistManager"));
const OutlineManager = lazy(() => import("../components/outline/OutlineManager"));
const SummaryOverviewView = lazy(() => import("../components/story/SummaryOverviewView"));
const StoryboardView = lazy(() => import("../components/story/StoryboardView"));
const TodoListView = lazy(() => import("../components/story/TodoListView"));
const ManuscriptView = lazy(() => import("../components/manuscript/ManuscriptView"));
const MediaPage = lazy(() => import("./MediaPage"));
const StoryHealthPage = lazy(() => import("./StoryHealthPage"));
const ChroniclePage = lazy(() => import("./ChroniclePage"));
const DiscoveryQueuePage = lazy(() => import("./DiscoveryQueuePage"));
const StoryOverviewPage = lazy(() => import("./StoryOverviewPage"));
const PublishPage = lazy(() => import("./PublishPage"));
const VersionsPage = lazy(() => import("./VersionsPage"));
const WhatIfPage = lazy(() => import("./WhatIfPage"));
const LocationSheet = lazy(() => import("./LocationSheet"));

export default function StoryWorkspacePage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { setActiveStory, setStructure, setCharacters, setActiveTemplate, setBeatSheets, structure } =
    useStoryStore();
  const location = useLocation();
  const onWriteTab = location.pathname.endsWith("/write");
  const {
    viewState,
    viewMode,
    treeDetached,
    setViewMode,
    storySearchOpen,
    closeStorySearch,
    openStorySearch,
  } = useUIStore();
  const { setActiveNode } = useStoryStore();
  const [loading, setLoading] = useState(true);
  const isFocused = viewState === "focus";
  const [sidebarRevealed, setSidebarRevealed] = useState(false);
  const sidebarHideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!storyId) return;
    setLoading(true);
    Promise.all([
      api.getStory(storyId),
      api.getStructure(storyId),
      api.listCharacters(storyId),
      api.listStructureTemplates(),
      api.listBeatSheets(),
    ])
      .then(([story, structure, characters, templates, beatSheets]) => {
        setActiveStory(story);
        setStructure(structure);
        setCharacters(characters);
        setBeatSheets(beatSheets);
        const tmpl = templates.find((t) => t.id === story.structure_template_id) ?? null;
        setActiveTemplate(tmpl);
      })
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [storyId, setActiveStory, setStructure, setCharacters, setActiveTemplate, navigate]);

  // Auto-backup: check on load, then every 5 minutes while the story is open
  useEffect(() => {
    if (!storyId) return;
    api.checkAutoBackup(storyId).catch(() => {});
    const interval = setInterval(
      () => {
        api.checkAutoBackup(storyId).catch(() => {});
      },
      5 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [storyId]);

  // ⌘⇧F — open story-wide search panel
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (matchesCombo(e, SHORTCUTS.storySearch.combo)) {
        e.preventDefault();
        openStorySearch();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openStorySearch]);

  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  function startSidebarHide() {
    clearTimeout(sidebarHideTimerRef.current);
    sidebarHideTimerRef.current = setTimeout(() => setSidebarRevealed(false), 600);
  }

  function cancelSidebarHide() {
    clearTimeout(sidebarHideTimerRef.current);
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.mobileNotice} role="status">
        LoreStudio is optimized for desktop — some features may be limited on small screens.
      </div>
      {/* Focus mode: hover zone on left edge reveals collapsed sidebar */}
      {isFocused && !sidebarRevealed && (
        <div
          className={styles.sidebarHoverZone}
          onMouseEnter={() => {
            cancelSidebarHide();
            setSidebarRevealed(true);
          }}
        />
      )}

      {viewState === "normal" && <Sidebar />}
      {viewState === "normal" && treeDetached && onWriteTab && <StructureTreePanel />}
      {isFocused && sidebarRevealed && (
        <>
          <Sidebar collapsed={true} onMouseLeave={startSidebarHide} onMouseEnter={cancelSidebarHide} />
          {treeDetached && onWriteTab && (
            <StructureTreePanel onMouseLeave={startSidebarHide} onMouseEnter={cancelSidebarHide} overlay />
          )}
        </>
      )}

      {storySearchOpen && storyId && (
        <StorySearchPanel
          storyId={storyId}
          onClose={closeStorySearch}
          onNavigateToNode={(nodeId) => {
            const queue = [...structure];
            while (queue.length) {
              const n = queue.shift()!;
              if (n.id === nodeId) {
                setActiveNode(n);
                break;
              }
              if (n.children) queue.push(...n.children);
            }
            navigate(`/stories/${storyId}/write`);
            setViewMode("tree");
          }}
        />
      )}

      <main className={styles.main}>
        <Suspense fallback={<div className={styles.loading}>Loading…</div>}>
          <Routes>
            <Route path="/" element={<StoryOverviewPage />} />
            <Route path="/overview" element={<StoryOverviewPage />} />
            <Route
              path="/write"
              element={
                viewMode === "storyboard" ? (
                  <StoryboardView />
                ) : viewMode === "summary" ? (
                  <SummaryOverviewView />
                ) : viewMode === "todos" ? (
                  <TodoListView />
                ) : viewMode === "manuscript" ? (
                  <ManuscriptView
                    storyId={storyId!}
                    onNavigateToScene={(id) => {
                      const queue = [...structure];
                      while (queue.length) {
                        const n = queue.shift()!;
                        if (n.id === id) {
                          setActiveNode(n);
                          break;
                        }
                        if (n.children) queue.push(...n.children);
                      }
                      setViewMode("tree");
                    }}
                  />
                ) : (
                  <SceneEditor />
                )
              }
            />
            <Route path="/characters" element={<CharacterList storyId={storyId!} />} />
            <Route path="/characters/:characterId" element={<CharacterSheet />} />
            <Route path="/lorebook" element={<StoryIdentityPanel storyId={storyId!} />} />
            <Route path="/compendium" element={<CompendiumPanel storyId={storyId!} />} />
            <Route path="/worldbuilding" element={<WorldBuildingHub />} />
            <Route path="/locations/:locationId" element={<LocationSheet />} />
            <Route
              path="/panels"
              element={
                <ModeGate route={ROUTE("panels")}>
                  <PanelInterviewPanel storyId={storyId!} />
                </ModeGate>
              }
            />
            <Route path="/outline" element={<OutlineManager storyId={storyId!} />} />
            <Route path="/threads" element={<PlotThreadManager storyId={storyId!} />} />
            <Route
              path="/twists"
              element={
                <ModeGate route={ROUTE("twists")}>
                  <TwistManager storyId={storyId!} />
                </ModeGate>
              }
            />
            <Route path="/media" element={<MediaPage />} />
            <Route path="/health" element={<StoryHealthPage />} />
            <Route
              path="/discoveries"
              element={
                <ModeGate route={ROUTE("discoveries")}>
                  <DiscoveryQueuePage />
                </ModeGate>
              }
            />
            <Route path="/chronicle" element={<ChroniclePage />} />
            <Route
              path="/publish"
              element={
                <ModeGate route={ROUTE("publish")}>
                  <PublishPage />
                </ModeGate>
              }
            />
            <Route path="/versions" element={<VersionsPage />} />
            <Route
              path="/whatif"
              element={
                <ModeGate route={ROUTE("whatif")}>
                  <WhatIfPage />
                </ModeGate>
              }
            />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
