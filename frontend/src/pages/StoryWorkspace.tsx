import { useEffect, useState } from "react";
import { useParams, useNavigate, Routes, Route } from "react-router-dom";
import { api } from "../api/client";
import { useStoryStore } from "../stores/storyStore";
import { useUIStore } from "../stores/uiStore";
import Sidebar from "../components/layout/Sidebar";
import InterviewPanel from "../components/layout/InterviewPanel";
import SceneEditor from "../components/story/SceneEditor";
import CharacterSheet from "../components/characters/CharacterSheet";
import CharacterList from "../components/characters/CharacterList";
import StoryBiblePanel from "../components/story/StoryBiblePanel";
import PanelInterviewPanel from "../components/panels/PanelInterviewPanel";
import PlotThreadManager from "../components/threads/PlotThreadManager";
import CorkboardView from "../components/story/CorkboardView";
import styles from "./StoryWorkspace.module.css";

export default function StoryWorkspacePage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { setActiveStory, setStructure, setCharacters, setActiveTemplate } = useStoryStore();
  const { interviewPanelOpen, activeInterview, focusMode, viewMode } = useUIStore();
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
      {!focusMode && <Sidebar />}

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={viewMode === "corkboard" ? <CorkboardView /> : <SceneEditor />} />
          <Route path="/characters" element={<CharacterList storyId={storyId!} />} />
          <Route path="/characters/:characterId" element={<CharacterSheet />} />
          <Route path="/bible" element={<StoryBiblePanel storyId={storyId!} />} />
          <Route path="/panels" element={<PanelInterviewPanel storyId={storyId!} />} />
          <Route path="/threads" element={<PlotThreadManager storyId={storyId!} />} />
        </Routes>
      </main>

      {interviewPanelOpen && activeInterview && <InterviewPanel />}
    </div>
  );
}
