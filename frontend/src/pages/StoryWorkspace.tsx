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
import styles from "./StoryWorkspace.module.css";

export default function StoryWorkspacePage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { setActiveStory, setStructure, setCharacters } = useStoryStore();
  const { interviewPanelOpen, activeInterview, focusMode } = useUIStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storyId) return;
    setLoading(true);
    Promise.all([
      api.getStory(storyId),
      api.getStructure(storyId),
      api.listCharacters(storyId),
    ])
      .then(([story, structure, characters]) => {
        setActiveStory(story);
        setStructure(structure);
        setCharacters(characters);
      })
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [storyId, setActiveStory, setStructure, setCharacters, navigate]);

  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  return (
    <div className={styles.workspace}>
      {!focusMode && <Sidebar />}

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<SceneEditor />} />
          <Route path="/characters" element={<CharacterList storyId={storyId!} />} />
          <Route path="/characters/:characterId" element={<CharacterSheet />} />
        </Routes>
      </main>

      {interviewPanelOpen && activeInterview && <InterviewPanel />}
    </div>
  );
}
