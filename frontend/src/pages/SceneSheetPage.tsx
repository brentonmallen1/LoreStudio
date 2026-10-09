import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Orbit, PenLine } from "lucide-react";
import { api } from "../api/client";
import FindingsCard from "../components/findings/FindingsCard";
import { findNode } from "../components/layout/structureTreeMeta";
import AssetPicker from "../components/media/AssetPicker";
import DiagramThumbnail from "../components/media/DiagramThumbnail";
import SubjectNotes from "../components/notes/SubjectNotes";
import SceneLinksField from "../components/editor/panels/SceneLinksField";
import SceneSummaryField from "../components/editor/panels/SceneSummaryField";
import StoryPlanPanel from "../components/editor/panels/StoryPlanPanel";
import WhoIsHereField from "../components/editor/panels/WhoIsHereField";
import { flattenStructure } from "../components/editor/segmentMeta";
import ScenePromises from "../components/promises/ScenePromises";
import SceneFacts from "../components/scene/SceneFacts";
import SheetField from "../components/scene/SheetField";
import { findingsForNode } from "../lib/findings/group";
import { useAIAvailable } from "../lib/mode";
import { openScene } from "../lib/panel/openScene";
import { sceneSequence } from "../lib/panel/sequence";
import { useFullNode } from "../lib/panel/useFullNode";
import { neighbourLine } from "../lib/scene/glance";
import { useOpenFindings } from "../stores/findingsStore";
import { useProposalsStore } from "../stores/proposalsStore";
import { useStoryStore } from "../stores/storyStore";
import type { DiagramSummary, StructureNode } from "../types";
import styles from "../components/scene/SceneSheet.module.css";

const STATUS_LABEL: Record<string, string> = {
  planned: "Planned",
  draft: "Draft",
  revised: "Revised",
  final: "Final",
};

type Field = "synopsis" | "purpose" | "entry_state" | "exit_state" | "key_events";

/**
 * `/write/:nodeId/sheet` (doc 24 D19): every field of one scene on one page, where the This
 * scene tab sends you for more than a glance. Its words on the left (what happens, the turn,
 * why it is here, its promises); its facts, findings, notes and pictures on the right; the
 * scenes either side along the foot. "Write this scene" goes back to the prose.
 */
export default function SceneSheetPage() {
  const { storyId, nodeId } = useParams<{ storyId: string; nodeId: string }>();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const { structure, activeNode, setActiveNode, activeStory, activeTemplate, characters } = useStoryStore();
  const studio = useAIAvailable();
  const discoverIn = useProposalsStore((s) => s.discoverIn);
  const discovering = useProposalsStore((s) => s.discovering);
  const findings = findingsForNode(useOpenFindings(), nodeId ?? "");
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const listed = nodeId ? findNode(structure, nodeId) : undefined;
  const node = activeNode?.id === nodeId && activeNode?.content !== undefined ? activeNode : null;

  // The sheet is about the open node: the strip, the crumbs and the panel follow it.
  useEffect(() => {
    if (!listed) return;
    if (activeNode?.id !== listed.id) setActiveNode(listed);
    else if (activeNode.content === undefined)
      api.getNode(listed.id).then((full) => {
        if (useStoryStore.getState().activeNode?.id === full.id) setActiveNode(full);
      });
  }, [listed?.id, activeNode?.id, activeNode?.content === undefined]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!storyId || !nodeId) return;
    api
      .listDiagrams(storyId)
      .then((all) => setDiagrams(all.filter((d) => d.attached_node_id === nodeId)))
      .catch(() => {});
  }, [storyId, nodeId]);

  // Arriving from a line in the This scene tab: go to its part.
  useEffect(() => {
    if (node && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [!!node, hash]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!listed) return <Navigate to={`/stories/${storyId}/write`} replace />;
  if (!node || !activeStory) return <div className={styles.loading}>Loading…</div>;

  const sequence = sceneSequence(structure, activeTemplate, node.id);
  const words = node.word_count ?? 0;
  const pov = characters.find((c) => c.id === (node.pov_character_id ?? activeStory.pov_character_id));

  async function patch(fields: Parameters<typeof api.updateNode>[1]) {
    const saved = await api.updateNode(node!.id, fields);
    const current = useStoryStore.getState().activeNode;
    if (current?.id === saved.id) setActiveNode({ ...current, ...saved });
  }
  const save = (field: Field) => (value: string) => patch({ [field]: value });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headText}>
          {sequence && (
            <p className={styles.kicker}>
              Scene {sequence.position} of {sequence.total}
              {sequence.chapter ? ` · ${sequence.chapter}` : ""}
            </p>
          )}
          <h1 className={styles.title}>{node.title}</h1>
          <p className={styles.meta}>
            <span className={styles[`status_${node.status}`]}>
              {STATUS_LABEL[node.status] ?? node.status}
            </span>
            {` · ${words.toLocaleString()} ${words === 1 ? "word" : "words"}`}
            {pov ? ` · seen by ${pov.name}` : ""}
          </p>
        </div>
        <Link to={`/stories/${activeStory.id}/write/${node.id}`} className={styles.write}>
          <PenLine size={14} aria-hidden /> Write this scene
        </Link>
      </header>

      <div className={styles.columns}>
        <div className={styles.main}>
          <SheetField
            key={`${node.id}:synopsis`}
            label="Synopsis"
            prose
            initial={node.synopsis ?? ""}
            placeholder="What happens in this scene, in a sentence or two…"
            save={save("synopsis")}
          />
          <div className={styles.turn}>
            <div className={styles.box}>
              <SheetField
                key={`${node.id}:entry`}
                label="Coming in"
                initial={node.entry_state ?? ""}
                placeholder={`Who is ${pov?.name ?? "your point-of-view character"} before this scene begins? What do they believe?`}
                save={save("entry_state")}
              />
            </div>
            <div className={styles.box}>
              <SheetField
                key={`${node.id}:exit`}
                label="Going out"
                initial={node.exit_state ?? ""}
                placeholder="How has the character or situation changed by the end?"
                save={save("exit_state")}
              />
            </div>
          </div>
          <SheetField
            key={`${node.id}:purpose`}
            label="Purpose"
            initial={node.purpose ?? ""}
            placeholder="Why does this scene exist? What does it do that nothing else does?"
            save={save("purpose")}
          />
          <SheetField
            key={`${node.id}:events`}
            label="Key events"
            initial={node.key_events ?? ""}
            placeholder="What must happen in this scene? The pivotal moments or turning points."
            save={save("key_events")}
          />
          {node.content_summary && !studio && (
            <div className={styles.field}>
              <span className={styles.label}>What’s on the page · from the prose</span>
              <p className={styles.summary}>{node.content_summary}</p>
            </div>
          )}

          <section id="findings" className={styles.section}>
            <h2 className={styles.h2}>Findings{findings.length ? ` · ${findings.length}` : ""}</h2>
            <FindingsCard findings={findings} storyId={activeStory.id} empty="Nothing needs your eye here." />
          </section>

          <section id="promises" className={styles.section}>
            <h2 className={styles.h2}>Promises</h2>
            <ScenePromises storyId={activeStory.id} nodeId={node.id} />
          </section>
          <section id="links" className={styles.section}>
            <SceneLinksField
              activeNode={node}
              activeStory={activeStory}
              flatNodes={flattenStructure(structure)}
              onNavigate={(n: StructureNode) => openScene(n.id)}
            />
          </section>
        </div>

        <aside className={styles.side}>
          <div className={styles.box}>
            <SceneFacts node={node} story={activeStory} patch={patch} />
          </div>

          <section id="notes" className={styles.section}>
            <h2 className={styles.h2}>Notes</h2>
            <SubjectNotes storyId={activeStory.id} aboutType="scene" aboutId={node.id} name="this scene" />
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Images and diagrams</h2>
            {diagrams.length > 0 && (
              <div className={styles.diagrams}>
                {diagrams.map((d) => (
                  <DiagramThumbnail
                    key={d.id}
                    diagram={d}
                    onClick={() => navigate(`/stories/${activeStory.id}/lorebook/places`)}
                  />
                ))}
              </div>
            )}
            <AssetPicker
              storyId={activeStory.id}
              objectType="structure_node"
              objectId={node.id}
              label="Images & references"
            />
          </section>

          {studio && (
            <section className={`${styles.section} ${styles.ai}`}>
              <h2 className={styles.h2}>Assistant</h2>
              <WhoIsHereField activeNode={node} storyId={activeStory.id} />
              <SceneSummaryField key={node.id} activeNode={node} setActiveNode={setActiveNode} />
              {activeStory.discovery_enabled && (
                <button
                  type="button"
                  className={styles.aiBtn}
                  onClick={() => discoverIn(node.story_id, node.id).catch(() => {})}
                  disabled={discovering}
                  title="Analyze this scene for new characters, settings, and other story elements"
                >
                  <Orbit size={12} aria-hidden />
                  {discovering ? "Analyzing…" : "Analyze for discoveries"}
                </button>
              )}
            </section>
          )}

          <section className={styles.section}>
            <h2 className={styles.h2}>The story around it</h2>
            <StoryPlanPanel node={node} story={activeStory} characters={characters} />
          </section>
        </aside>
      </div>

      {sequence && (sequence.before || sequence.after) && (
        <nav className={styles.sides} aria-label="The scenes either side">
          {sequence.before ? <Side id={sequence.before.node.id} side="before" /> : <span />}
          {sequence.after && <Side id={sequence.after.node.id} side="after" />}
        </nav>
      )}
    </div>
  );
}

/** A scene either side: where it leaves things or picks up; a click opens it to write. */
function Side({ id, side }: { id: string; side: "before" | "after" }) {
  const full = useFullNode(id);
  const line = full ? neighbourLine(full, side) : null;
  return (
    <button
      type="button"
      className={`${styles.neighbour} ${side === "after" ? styles.after : ""}`}
      onClick={() => openScene(id)}
      title={full ? `Open “${full.title}” to write` : undefined}
    >
      <span className={styles.sideTitle}>
        {side === "before" ? `← ${full?.title ?? ""}` : `${full?.title ?? ""} →`}
      </span>
      {line && <span className={styles.sideLine}>{line}</span>}
    </button>
  );
}
