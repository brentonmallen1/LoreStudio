import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronRight, Orbit, PenLine } from "lucide-react";
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
import SceneFacts from "../components/scene/SceneFacts";
import SceneSides from "../components/scene/SceneSides";
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

const STATUS_LABEL: Record<string, string> = {
  planned: "Planned",
  draft: "Draft",
  revised: "Revised",
  final: "Final",
};

type Field = "synopsis" | "purpose" | "entry_state" | "exit_state" | "key_events";

/**
 * `/write/:nodeId/sheet` (doc 24 D19): every field of one scene on one page, where the This
 * scene tab sends you for more than a glance. One column of parts, each named in the bar under
 * the title so any of them is a click away: the plan (what happens, why, the turn), who, where
 * and when, findings, promises, notes and pictures, the Assistant; the story around it folded
 * at the foot, then the scenes either side. "Write this scene" goes back to the prose.
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

  const jump = (id: string, smooth = true) =>
    document.getElementById(id)?.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });

  // Arriving from a line in the This scene tab: go to its part, and hold it there while the
  // parts above it finish loading and grow, until the author scrolls or two seconds pass.
  const pageRef = useRef<HTMLDivElement>(null);
  const ready = !!node;
  useEffect(() => {
    const page = pageRef.current;
    if (!ready || !hash || !page) return;
    const id = hash.slice(1);
    const align = () => jump(id, false);
    align();
    const watch = new ResizeObserver(align);
    watch.observe(page);
    const quit = () => watch.disconnect();
    const timer = setTimeout(quit, 2000);
    const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    events.forEach((e) => window.addEventListener(e, quit, { once: true }));
    return () => {
      quit();
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, quit));
    };
  }, [ready, hash]);

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

  const parts = [
    { id: "plan", label: "The plan" },
    { id: "facts", label: "Who, where, when" },
    { id: "findings", label: findings.length ? `Findings · ${findings.length}` : "Findings" },
    { id: "promises", label: "Promises" },
    { id: "notes", label: "Notes and images" },
    ...(studio ? [{ id: "assistant", label: "Assistant" }] : []),
  ];

  return (
    <div className={styles.scroller}>
      <div className={styles.page} ref={pageRef}>
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

        <nav className={styles.jumps} aria-label="Parts of this sheet">
          {parts.map((p) => (
            <button key={p.id} type="button" className={styles.jump} onClick={() => jump(p.id)}>
              {p.label}
            </button>
          ))}
        </nav>

        <section id="plan" className={styles.section} aria-labelledby="sheet-plan">
          <h2 id="sheet-plan" className={styles.h2}>
            The plan
          </h2>
          <div className={styles.plan}>
            <div className={styles.stack}>
              <SheetField
                key={`${node.id}:synopsis`}
                label="Synopsis"
                prose
                initial={node.synopsis ?? ""}
                placeholder="What happens in this scene, in a sentence or two…"
                save={save("synopsis")}
              />
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
            </div>
            <div className={styles.stack}>
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
          </div>
          {studio ? (
            <div className={styles.onPage}>
              <SceneSummaryField key={node.id} activeNode={node} setActiveNode={setActiveNode} />
            </div>
          ) : (
            node.content_summary && (
              <div className={`${styles.field} ${styles.onPage}`}>
                <span className={styles.label}>What’s on the page · from the prose</span>
                <p className={styles.summary}>{node.content_summary}</p>
              </div>
            )
          )}
        </section>

        <section id="facts" className={styles.section} aria-labelledby="sheet-facts">
          <h2 id="sheet-facts" className={styles.h2}>
            Who, where and when
          </h2>
          <SceneFacts node={node} story={activeStory} patch={patch} />
        </section>

        <section id="findings" className={styles.section} aria-labelledby="sheet-findings">
          <h2 id="sheet-findings" className={styles.h2}>
            Findings{findings.length ? ` · ${findings.length}` : ""}
          </h2>
          <FindingsCard
            findings={findings}
            storyId={activeStory.id}
            empty="Nothing needs your eye in this scene."
          />
          <QuotesField activeNode={node} />
        </section>

        <section id="promises" className={styles.section} aria-labelledby="sheet-promises">
          <h2 id="sheet-promises" className={styles.h2}>
            Promises
          </h2>
          <ScenePromises storyId={activeStory.id} nodeId={node.id} />
          <div id="links">
            <SceneLinksField
              activeNode={node}
              activeStory={activeStory}
              flatNodes={flattenStructure(structure)}
              onNavigate={(n: StructureNode) => openScene(n.id)}
            />
          </div>
        </section>

        <div className={styles.pair}>
          <section id="notes" className={styles.section} aria-labelledby="sheet-notes">
            <h2 id="sheet-notes" className={styles.h2}>
              Notes
            </h2>
            <SubjectNotes storyId={activeStory.id} aboutType="scene" aboutId={node.id} name="this scene" />
          </section>
          <section id="images" className={styles.section} aria-labelledby="sheet-images">
            <h2 id="sheet-images" className={styles.h2}>
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

        {studio && (
          <section id="assistant" className={`${styles.section} ${styles.ai}`} aria-labelledby="sheet-ai">
            <h2 id="sheet-ai" className={styles.h2}>
              Assistant
            </h2>
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
          </section>
        )}

        <details className={styles.around}>
          <summary className={styles.aroundHead}>
            <ChevronRight size={14} className={styles.aroundChevron} aria-hidden />
            The story around it
            <span className={styles.aroundHint}>the logline, the conflict, what the people here want</span>
          </summary>
          <StoryPlanPanel node={node} story={activeStory} characters={characters} />
        </details>

        {sequence && <SceneSides sequence={sequence} />}
      </div>
    </div>
  );
}
