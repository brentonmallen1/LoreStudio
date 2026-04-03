import { useEffect, useState } from "react";
import { useParams, useNavigate, Routes, Route } from "react-router-dom";
import { api } from "../api/client";
import { useStoryStore } from "../stores/storyStore";
import { useLocation } from "react-router-dom";
import { useUIStore } from "../stores/uiStore";
import Sidebar from "../components/layout/Sidebar";
import InterviewPanel from "../components/layout/InterviewPanel";
import SceneChatPanel from "../components/layout/SceneChatPanel";
import SceneEditor from "../components/story/SceneEditor";
import CharacterSheet from "../components/characters/CharacterSheet";
import CharacterList from "../components/characters/CharacterList";
import LorebookPanel from "../components/story/LorebookPanel";
import PanelInterviewPanel from "../components/panels/PanelInterviewPanel";
import PlotThreadManager from "../components/threads/PlotThreadManager";
import CorkboardView from "../components/story/CorkboardView";
import TimelineView from "../components/story/TimelineView";
import MediaPage from "./MediaPage";
import StoryHealthPage from "./StoryHealthPage";
import styles from "./StoryWorkspace.module.css";

export default function StoryWorkspacePage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isSceneView = !location.pathname.match(/\/(characters|lorebook|panels|threads|media|health)/);

  const { setActiveStory, setStructure, setCharacters, setActiveTemplate } = useStoryStore();
  const { interviewPanelOpen, activeInterview, viewState, viewMode, chatPanelOpen } = useUIStore();
  const { activeNode } = useStoryStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storyId) return;
    setLoading(true);
    Promise.all([
      api.getStory(storyId),
      api.getStructure(storyId),
      api.listCharacters(storyId),
      api.listStructureTemplates(),
    ])
      .then(([story, structure, characters, templates]) => {
        setActiveStory(story);
        setStructure(structure);
        setCharacters(characters);
        const tmpl = templates.find((t) => t.id === story.structure_template_id) ?? null;
        setActiveTemplate(tmpl);
      })
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [storyId, setActiveStory, setStructure, setCharacters, setActiveTemplate, navigate]);

  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  return (
    <div className={styles.workspace}>
      {viewState === "normal" && <Sidebar />}

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={
            viewMode === "corkboard" ? <CorkboardView /> :
            viewMode === "timeline" ? <TimelineView /> :
            <SceneEditor />
          } />
          <Route path="/characters" element={<CharacterList storyId={storyId!} />} />
          <Route path="/characters/:characterId" element={<CharacterSheet />} />
          <Route path="/lorebook" element={<LorebookPanel storyId={storyId!} />} />
          <Route path="/panels" element={<PanelInterviewPanel storyId={storyId!} />} />
          <Route path="/threads" element={<PlotThreadManager storyId={storyId!} />} />
          <Route path="/media" element={<MediaPage />} />
          <Route path="/health" element={<StoryHealthPage />} />
        </Routes>
      </main>

      {interviewPanelOpen && activeInterview && <InterviewPanel />}
      {chatPanelOpen && isSceneView && storyId && activeNode && (
        <SceneChatPanel storyId={storyId} nodeId={activeNode.id} />
      )}
    </div>
  );
}
