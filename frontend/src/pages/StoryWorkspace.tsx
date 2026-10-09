import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { sceneCastApi } from "../api/sceneCast";
import { loadStoryIntoStores } from "../lib/story/loadStory";
import { findNode } from "../components/layout/structureTreeMeta";
import { rememberScene, sceneToResume } from "../lib/resumeScene";
import { useReloadOnUndo } from "../hooks/useUndoRedo";
import { useStoryStore } from "../stores/storyStore";
import { usePanelStore } from "../stores/panelStore";
import { useFeedSync } from "../stores/findingsStore";
import { useSeriesStore } from "../stores/seriesStore";
import { SERIES_UNDO_TYPES } from "../lib/series/refresh";
import { useUIStore } from "../stores/uiStore";
import { SHORTCUTS, matchesCombo } from "../lib/keyboard/shortcuts";
import { goToAdjacentScene, openSceneId } from "../lib/story/adjacentScene";
import StoryStrip from "../components/strip/StoryStrip";
import StoryPanel from "../components/panel/StoryPanel";
import StorySearchPanel from "../components/story/StorySearchPanel";
import ExportDialog from "../components/manuscript/ExportDialog";
import StoryRoutes from "./storyRoutes";
import styles from "./StoryWorkspace.module.css";

export default function StoryWorkspacePage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { setActiveNode, setSceneCast } = useStoryStore();
  const { viewState, storySearchOpen, closeStorySearch, openStorySearch } = useUIStore();
  const [loading, setLoading] = useState(true);
  const isFocused = viewState === "focus";
  const [stripRevealed, setStripRevealed] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useFeedSync(storyId);
  // Undo can take an element back out of this book, or put it back.
  useReloadOnUndo(SERIES_UNDO_TYPES, () => useSeriesStore.getState().refetch());

  // `navigate` changes identity whenever the location does; reading it through a ref keeps
  // this effect to "the story changed". Depending on it reloaded the whole story, and
  // remounted every page, on each navigation inside the story.
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  });

  useEffect(() => {
    if (!storyId) return;
    const navigate = navigateRef.current;
    setLoading(true);
    loadStoryIntoStores(storyId)
      .then((structure) => {
        // Open the scene a link names, keep one already open in this story, or resume
        // where the author left off (lib/resumeScene.ts). Read once, at load.
        const requested = new URLSearchParams(window.location.search).get("node");
        const current = useStoryStore.getState().activeNode;
        const keep = current?.story_id === storyId && findNode(structure, current.id);
        if (requested || !keep) setActiveNode(sceneToResume(storyId, structure, requested));
        if (requested) navigate({ search: "" }, { replace: true });
      })
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [storyId, setActiveNode]);

  // The panel knows whether it is beside the prose (doc 12 P2). Open or collapsed is the
  // author's one choice for every page: moving between them never changes it.
  const { pathname } = useLocation();
  const setPanelSide = usePanelStore((s) => s.setSide);
  const writing = pathname.includes("/write");
  useEffect(() => {
    setPanelSide(writing ? "writing" : "pages");
  }, [writing, setPanelSide]);

  // Remember the open scene per story, so the Write page reopens it next time.
  const activeNode = useStoryStore((s) => s.activeNode);
  useEffect(() => {
    if (storyId && activeNode?.story_id === storyId) rememberScene(storyId, activeNode.id);
  }, [storyId, activeNode]);

  // Who is in each scene changes as the prose does: refresh when the scene changes and
  // after an undo touches the tree, presence or thread placement.
  const reloadCast = useCallback(() => {
    if (storyId)
      sceneCastApi
        .get(storyId)
        .then(setSceneCast)
        .catch(() => {});
  }, [storyId, setSceneCast]);
  useEffect(() => {
    if (activeNode?.id) reloadCast();
  }, [activeNode?.id, reloadCast]);
  useReloadOnUndo(["structure_node", "plot_thread_appearance", "scene_presence"], reloadCast);

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

  // ⌘⇧F — open story-wide search panel; ⌥⌘↑ / ⌥⌘↓ — the scene before or after
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (matchesCombo(e, SHORTCUTS.storySearch.combo)) {
        e.preventDefault();
        openStorySearch();
      }
      // ⌥⌘↑ / ⌥⌘↓: the scene before or after, while one is open.
      const dir = matchesCombo(e, SHORTCUTS.nextScene.combo)
        ? 1
        : matchesCombo(e, SHORTCUTS.prevScene.combo)
          ? -1
          : 0;
      if (dir && openSceneId()) {
        e.preventDefault();
        goToAdjacentScene(dir);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openStorySearch]);

  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  function startHide() {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setStripRevealed(false), 600);
  }

  function cancelHide() {
    clearTimeout(hideTimerRef.current);
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.mobileNotice} role="status">
        LoreStudio is optimized for desktop; some features may be limited on small screens.
      </div>
      {/* Focus mode: the left edge reveals the strip */}
      {isFocused && !stripRevealed && (
        <div
          className={styles.sidebarHoverZone}
          onMouseEnter={() => {
            cancelHide();
            setStripRevealed(true);
          }}
        />
      )}

      {viewState === "normal" && <StoryStrip />}
      {isFocused && stripRevealed && (
        <div className={styles.revealed} onMouseLeave={startHide} onMouseEnter={cancelHide}>
          <StoryStrip />
        </div>
      )}

      {storyId && <ExportDialog storyId={storyId} />}

      {storySearchOpen && storyId && (
        <StorySearchPanel
          storyId={storyId}
          onClose={closeStorySearch}
          onNavigateToNode={(nodeId) => navigate(`/stories/${storyId}/write/${nodeId}`)}
        />
      )}

      <main className={styles.main}>
        <Suspense fallback={<div className={styles.loading}>Loading…</div>}>
          <StoryRoutes />
        </Suspense>
      </main>
      {viewState === "normal" && <StoryPanel />}
    </div>
  );
}
