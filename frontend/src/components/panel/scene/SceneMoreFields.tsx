import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Telescope } from "lucide-react";
import { api } from "../../../api/client";
import type { Character, DiagramSummary, Story, StructureNode } from "../../../types";
import { useAIAvailable } from "../../../lib/mode";
import { isOpen } from "../../../lib/notes/grouping";
import { useProposalsStore } from "../../../stores/proposalsStore";
import { useStoryStore } from "../../../stores/storyStore";
import DiagramThumbnail from "../../media/DiagramThumbnail";
import AssetPicker from "../../media/AssetPicker";
import type { InlineNotesState } from "../../editor/useInlineNotes";
import { flattenStructure } from "../../editor/segmentMeta";
import LinkedTwistsField from "../../editor/panels/LinkedTwistsField";
import SceneLinksField from "../../editor/panels/SceneLinksField";
import SceneNotesField from "../../editor/panels/SceneNotesField";
import SceneSummaryField from "../../editor/panels/SceneSummaryField";
import StoryPlanPanel from "../../editor/panels/StoryPlanPanel";
import WhoIsHereField from "../../editor/panels/WhoIsHereField";
import editorStyles from "../../editor/SceneEditor.module.css";
import Fold from "./Fold";
import styles from "./SceneSequence.module.css";

/**
 * Everything about the scene that is not its run from entry to exit, folded below the
 * sequence: notes, the story plan, links and twists, images, and in Studio mode the
 * Assistant. Each fold stays as the author left it. Keyed by node id by its parent.
 */
export default function SceneMoreFields({
  activeNode,
  activeStory,
  characters,
  notes,
}: {
  activeNode: StructureNode;
  activeStory: Story;
  characters: Character[];
  /** The editor's live notes; absent when the panel is open on another page. */
  notes?: InlineNotesState;
}) {
  const { setActiveNode, structure } = useStoryStore();
  const studio = useAIAvailable();
  const discoverIn = useProposalsStore((s) => s.discoverIn);
  const isAnalyzing = useProposalsStore((s) => s.discovering);
  const navigate = useNavigate();
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);

  useEffect(() => {
    api
      .listDiagrams(activeStory.id)
      .then((all) => setDiagrams(all.filter((d) => d.attached_node_id === activeNode.id)))
      .catch(() => {});
  }, [activeNode.id, activeStory.id]);

  return (
    <>
      {notes && (
        <Fold
          id="notes"
          title="Notes"
          count={notes.sceneNotes.filter(isOpen).length || undefined}
          defaultOpen
        >
          <SceneNotesField notes={notes} bare />
        </Fold>
      )}

      <Fold id="plan" title="Story plan" flush>
        <StoryPlanPanel node={activeNode} story={activeStory} characters={characters} />
      </Fold>

      <Fold id="links" title="Links and twists">
        <SceneLinksField
          activeNode={activeNode}
          activeStory={activeStory}
          flatNodes={flattenStructure(structure)}
          onNavigate={setActiveNode}
        />
        <LinkedTwistsField activeNode={activeNode} activeStory={activeStory} />
      </Fold>

      <Fold id="images" title="Images and diagrams" count={diagrams.length || undefined}>
        {diagrams.length > 0 && (
          <div className={editorStyles.overviewField}>
            <label className={editorStyles.overviewLabel}>Diagrams</label>
            <div className={editorStyles.diagramThumbnails}>
              {diagrams.map((d) => (
                <DiagramThumbnail
                  key={d.id}
                  diagram={d}
                  onClick={() => navigate(`/stories/${activeStory.id}/lorebook/places`)}
                />
              ))}
            </div>
          </div>
        )}
        <AssetPicker
          storyId={activeStory.id}
          objectType="structure_node"
          objectId={activeNode.id}
          label="Images & references"
        />
      </Fold>

      {studio && (
        <Fold id="assistant" title="Assistant" className={styles.ai}>
          <WhoIsHereField activeNode={activeNode} storyId={activeStory.id} />
          <SceneSummaryField activeNode={activeNode} setActiveNode={setActiveNode} />
          {activeStory.discovery_enabled && (
            <button
              className={editorStyles.analyzeBtn}
              onClick={() => discoverIn(activeNode.story_id, activeNode.id).catch(() => {})}
              disabled={isAnalyzing}
              title="Analyze this scene for new characters, settings, and other story elements"
            >
              <Telescope size={12} />
              {isAnalyzing ? "Analyzing…" : "Analyze for discoveries"}
            </button>
          )}
        </Fold>
      )}
    </>
  );
}
