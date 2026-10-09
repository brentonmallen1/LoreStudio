import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronRight, Orbit } from "lucide-react";
import { api } from "../api/client";
import FindingsCard from "../components/findings/FindingsCard";
import { findNode } from "../components/layout/structureTreeMeta";
import AssetPicker from "../components/media/AssetPicker";
import DiagramThumbnail from "../components/media/DiagramThumbnail";
import SubjectNotes from "../components/notes/SubjectNotes";
import QuotesField from "../components/editor/panels/QuotesField";
import SceneLinksField from "../components/editor/panels/SceneLinksField";
import SceneSummaryField from "../components/editor/panels/SceneSummaryField";
import StoryPlanPanel from "../components/editor/panels/StoryPlanPanel";
import WhoIsHereField from "../components/editor/panels/WhoIsHereField";
import { flattenStructure } from "../components/editor/segmentMeta";
import ScenePromises from "../components/promises/ScenePromises";
import SceneCard from "../components/scene/SceneCard";
import SceneFacts from "../components/scene/SceneFacts";
import SheetField from "../components/scene/SheetField";
import { findingsForNode } from "../lib/findings/group";
import { useAIAvailable } from "../lib/mode";
import { openScene } from "../lib/panel/openScene";
import { sceneSequence } from "../lib/panel/sequence";
import { useOpenFindings } from "../stores/findingsStore";
import { useProposalsStore } from "../stores/proposalsStore";
import { useStoryStore } from "../stores/storyStore";
import type { DiagramSummary, StructureNode } from "../types";
import styles from "../components/scene/SceneSheet.module.css";

type Field = "synopsis" | "purpose" | "entry_state" | "exit_state" | "key_events";
type Page = "plan" | "promises" | "notes" | "findings" | "facts" | "assistant";

/** The page an address names: `#links` is on Promises; anything unknown is The plan. */
function pageOf(hash: string, studio: boolean): Page {
  const id = hash.replace(/^#/, "");
  if (id === "links") return "promises";
  const pages: Page[] = [
    "plan",
    "promises",
    "notes",
    "findings",
    "facts",
    ...(studio ? ["assistant" as const] : []),
  ];
  return (pages as string[]).includes(id) ? (id as Page) : "plan";
}

/**
 * `/write/:nodeId/sheet` (doc 24 D19, canvas 8d): every field of one scene. A third of the
 * page is the scene's index card, always in view (what happens, the turn, who, where, beat,
 * when, Write, the scenes either side); two thirds are its pages, as on a character's sheet:
 * The plan, Promises, Notes, Findings, Who, where and when, and in Studio mode the Assistant.
 * The page is in the address (`#promises`), so a line in the This scene tab opens on it.
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
  const page = pageOf(hash, studio);

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

  if (!listed) return <Navigate to={`/stories/${storyId}/write`} replace />;
  if (!node || !activeStory) return <div className={styles.loading}>Loading…</div>;

  const sequence = sceneSequence(structure, activeTemplate, node.id);
  const pov = characters.find((c) => c.id === (node.pov_character_id ?? activeStory.pov_character_id));
  const go = (to: Page) => navigate({ hash: to === "plan" ? "" : to }, { replace: true });

  async function patch(fields: Parameters<typeof api.updateNode>[1]) {
    const saved = await api.updateNode(node!.id, fields);
    const current = useStoryStore.getState().activeNode;
    if (current?.id === saved.id) setActiveNode({ ...current, ...saved });
  }
  const save = (field: Field) => (value: string) => patch({ [field]: value });

  const tabs: { id: Page; label: string; count?: number }[] = [
    { id: "plan", label: "The plan" },
    { id: "promises", label: "Promises" },
    { id: "notes", label: "Notes" },
    { id: "findings", label: "Findings", count: findings.length || undefined },
    { id: "facts", label: "Who, where, when" },
    ...(studio ? [{ id: "assistant" as const, label: "Assistant" }] : []),
  ];

  return (
    <div className={styles.scroller}>
      <div className={styles.layout}>
        <SceneCard
          node={node}
          story={activeStory}
          sequence={sequence}
          povName={pov?.name}
          save={save}
          onFacts={() => go("facts")}
          refresh={page}
        />

        <div className={styles.pages}>
          <div className={styles.tabs} role="tablist" aria-label="The scene's pages">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={page === t.id}
                className={`${styles.tab} ${page === t.id ? styles.tabOn : ""} ${t.id === "assistant" ? styles.tabAi : ""}`}
                onClick={() => go(t.id)}
              >
                {t.label}
                {t.count && <span className={styles.count}>{t.count}</span>}
              </button>
            ))}
          </div>

          <div className={styles.pane} role="tabpanel">
            {page === "plan" && (
              <>
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
                {studio ? (
                  <div className={styles.box}>
                    <SceneSummaryField key={node.id} activeNode={node} setActiveNode={setActiveNode} />
                  </div>
                ) : (
                  node.content_summary && (
                    <div className={`${styles.box} ${styles.field}`}>
                      <span className={styles.label}>What’s on the page · from the prose</span>
                      <p className={styles.summary}>{node.content_summary}</p>
                    </div>
                  )
                )}
                <details className={styles.around}>
                  <summary className={styles.aroundHead}>
                    <ChevronRight size={14} className={styles.aroundChevron} aria-hidden />
                    The story around it
                    <span className={styles.aroundHint}>
                      the logline, the conflict, what the people here want
                    </span>
                  </summary>
                  <StoryPlanPanel node={node} story={activeStory} characters={characters} />
                </details>
              </>
            )}

            {page === "promises" && (
              <>
                <ScenePromises storyId={activeStory.id} nodeId={node.id} />
                <SceneLinksField
                  activeNode={node}
                  activeStory={activeStory}
                  flatNodes={flattenStructure(structure)}
                  onNavigate={(n: StructureNode) => openScene(n.id)}
                />
              </>
            )}

            {page === "notes" && (
              <div className={styles.pair}>
                <section className={styles.part} aria-label="Notes">
                  <SubjectNotes
                    storyId={activeStory.id}
                    aboutType="scene"
                    aboutId={node.id}
                    name="this scene"
                  />
                </section>
                <section className={styles.part} aria-labelledby="sheet-images">
                  <h2 id="sheet-images" className={styles.label}>
                    Images and diagrams
                  </h2>
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
              </div>
            )}

            {page === "findings" && (
              <>
                <FindingsCard
                  findings={findings}
                  storyId={activeStory.id}
                  empty="Nothing needs your eye in this scene."
                />
                <div className={styles.box}>
                  <QuotesField activeNode={node} />
                </div>
              </>
            )}

            {page === "facts" && <SceneFacts node={node} story={activeStory} patch={patch} />}

            {page === "assistant" && studio && (
              <div className={styles.ai}>
                <WhoIsHereField activeNode={node} storyId={activeStory.id} />
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
