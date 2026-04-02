import { useEffect, useRef, useState } from "react";
import type { StructureNode, SceneLink } from "../../types";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Typography from "@tiptap/extension-typography";
import { Maximize2, Minimize2, BookOpen, FileText, Flag, BookMarked, Clapperboard, Layers, Zap, Puzzle, Milestone, Plus, X, type LucideIcon } from "lucide-react";

const SEGMENT_ICONS: Record<string, LucideIcon> = {
  act: Flag,
  chapter: BookMarked,
  scene: Clapperboard,
  section: Layers,
  beat: Zap,
  part: Puzzle,
  stage: Milestone,
};

function getSegmentIcon(levelType: string): LucideIcon {
  return SEGMENT_ICONS[levelType.toLowerCase()] ?? Layers;
}

function segmentColor(levelType: string): string {
  const key = levelType.toLowerCase();
  const known = ["act", "chapter", "scene", "section", "beat", "part", "stage"];
  return known.includes(key) ? `var(--segment-${key})` : "var(--color-accent)";
}

const LINK_TYPES = [
  { value: "foreshadowing", forward: "Foreshadows →", reverse: "← Foreshadowed by" },
  { value: "callback", forward: "Calls back to →", reverse: "← Called back by" },
  { value: "causes", forward: "Causes →", reverse: "← Caused by" },
  { value: "parallel", forward: "Parallels →", reverse: "← Paralleled by" },
  { value: "contrast", forward: "Contrasts with →", reverse: "← Contrasted by" },
  { value: "echoes", forward: "Echoes →", reverse: "← Echoed by" },
];

function flattenStructure(nodes: StructureNode[]): StructureNode[] {
  const result: StructureNode[] = [];
  function walk(n: StructureNode) {
    result.push(n);
    n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import StorySummaryPanel from "./StorySummaryPanel";
import SceneThreadBadges from "../threads/SceneThreadBadges";
import styles from "./SceneEditor.module.css";

export default function SceneEditor() {
  const { activeNode, setActiveNode, activeStory, activeTemplate, structure } = useStoryStore();
  const { focusMode, toggleFocusMode } = useUIStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overviewSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [synopsis, setSynopsis] = useState("");
  const [purpose, setPurpose] = useState("");
  const [entryState, setEntryState] = useState("");
  const [exitState, setExitState] = useState("");
  const [keyEvents, setKeyEvents] = useState("");

  // Scene links state
  const [sceneLinks, setSceneLinks] = useState<SceneLink[]>([]);
  const [showAddLink, setShowAddLink] = useState(false);
  const [addLinkType, setAddLinkType] = useState("foreshadowing");
  const [addLinkNote, setAddLinkNote] = useState("");
  const [addLinkTarget, setAddLinkTarget] = useState<StructureNode | null>(null);
  const [addLinkSearch, setAddLinkSearch] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Begin writing…" }),
      CharacterCount,
      Typography,
    ],
    content: activeNode?.content ?? "",
    onUpdate: ({ editor }) => {
      if (!activeNode) return;
      const content = editor.getHTML();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        const wordCount = editor.storage.characterCount?.words() ?? 0;
        const updated = await api.updateNode(activeNode.id, { content, word_count: wordCount });
        setActiveNode({ ...activeNode, content, word_count: updated.word_count });
      }, 1200);
    },
  });

  useEffect(() => {
    if (!editor || !activeNode) return;
    const current = editor.getHTML();
    if (current !== activeNode.content) {
      editor.commands.setContent(activeNode.content ?? "");
    }
  }, [activeNode?.id]);

  useEffect(() => {
    if (!activeNode) return;
    setSynopsis(activeNode.synopsis ?? "");
    setPurpose(activeNode.metadata_?.purpose ?? "");
    setEntryState(activeNode.entry_state ?? "");
    setExitState(activeNode.exit_state ?? "");
    setKeyEvents(activeNode.key_events ?? "");
  }, [activeNode?.id]);

  // Load scene links when active node changes
  useEffect(() => {
    if (!activeNode) { setSceneLinks([]); return; }
    api.getSceneLinks({ node_id: activeNode.id }).then(setSceneLinks).catch(() => {});
  }, [activeNode?.id]);

  function scheduleOverviewSave(patch: { synopsis?: string; metadata_?: { purpose?: string } }) {
    if (overviewSaveRef.current) clearTimeout(overviewSaveRef.current);
    overviewSaveRef.current = setTimeout(async () => {
      if (!activeNode) return;
      const updated = await api.updateNode(activeNode.id, patch);
      setActiveNode({ ...activeNode, ...updated });
    }, 900);
  }

  // Scene link helpers
  const flatNodes = flattenStructure(structure);

  function findNode(id: string): StructureNode | undefined {
    return flatNodes.find(n => n.id === id);
  }

  function getLinkLabel(link: SceneLink, isForward: boolean): string {
    const t = LINK_TYPES.find(lt => lt.value === link.link_type);
    if (!t) return isForward ? `${link.link_type} →` : `← ${link.link_type}`;
    return isForward ? t.forward : t.reverse;
  }

  function handleNavigateToLink(link: SceneLink) {
    if (!activeNode) return;
    const targetId = link.source_node_id === activeNode.id ? link.target_node_id : link.source_node_id;
    const node = findNode(targetId);
    if (node) setActiveNode(node);
  }

  async function handleDeleteLink(linkId: string) {
    setSceneLinks(prev => prev.filter(l => l.id !== linkId));
    try { await api.deleteSceneLink(linkId); } catch { /* optimistic removal stands */ }
  }

  async function handleCreateLink() {
    if (!activeNode || !activeStory || !addLinkTarget) return;
    try {
      const link = await api.createSceneLink({
        story_id: activeStory.id,
        source_node_id: activeNode.id,
        target_node_id: addLinkTarget.id,
        link_type: addLinkType,
        note: addLinkNote,
      });
      setSceneLinks(prev => [...prev, link]);
    } catch { /* silently ignore */ }
    setShowAddLink(false);
    setAddLinkTarget(null);
    setAddLinkNote("");
    setAddLinkType("foreshadowing");
    setAddLinkSearch("");
  }

  const wordCount = editor?.storage.characterCount?.words() ?? 0;

  if (!activeNode) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>Select a section from the sidebar to begin writing.</p>
      </div>
    );
  }

  const STATUS_CYCLE: StructureNode["status"][] = ["draft", "revised", "final"];

  async function cycleStatus() {
    if (!activeNode) return;
    const idx = STATUS_CYCLE.indexOf(activeNode.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    const updated = await api.updateNode(activeNode.id, { status: next });
    setActiveNode({ ...activeNode, status: updated.status });
  }

  const statusClass =
    activeNode.status === "final"
      ? styles.final
      : activeNode.status === "revised"
      ? styles.revised
      : "";

  // Derive display name for this node's level from the active template
  const levelLabel = (() => {
    if (!activeTemplate) return activeNode.level_type;
    const lvl = activeTemplate.levels[activeNode.level];
    return lvl?.name ?? activeNode.level_type;
  })();

  async function changeType(newType: string, newLevel: number) {
    if (!activeNode) return;
    const updated = await api.updateNode(activeNode.id, { level_type: newType, level: newLevel });
    setActiveNode({ ...activeNode, ...updated });
  }

  return (
    <div className={styles.container}>
      <div className={styles.topbar}>
        <div className={styles.titleGroup}>
          {(() => {
            const Icon = getSegmentIcon(activeNode.level_type);
            const color = segmentColor(activeNode.level_type);
            return <Icon size={14} className={styles.typeIcon} style={{ color }} />;
          })()}
          {activeTemplate ? (
            <select
              className={styles.typeSelect}
              style={{
                color: segmentColor(activeNode.level_type),
                background: `color-mix(in srgb, ${segmentColor(activeNode.level_type)} 10%, transparent)`,
                borderColor: `color-mix(in srgb, ${segmentColor(activeNode.level_type)} 25%, transparent)`,
              }}
              value={activeNode.level}
              onChange={(e) => {
                const idx = Number(e.target.value);
                const lvl = activeTemplate.levels[idx];
                if (lvl) changeType(lvl.name.toLowerCase(), idx);
              }}
              title="Change segment type"
            >
              {activeTemplate.levels.map((lvl, idx) => (
                <option key={idx} value={idx}>{lvl.name}</option>
              ))}
            </select>
          ) : (
            <span
              className={styles.typeBadge}
              style={{
                color: segmentColor(activeNode.level_type),
                background: `color-mix(in srgb, ${segmentColor(activeNode.level_type)} 10%, transparent)`,
                borderColor: `color-mix(in srgb, ${segmentColor(activeNode.level_type)} 25%, transparent)`,
              }}
            >
              {levelLabel}
            </span>
          )}
          <span className={styles.nodeTitle}>{activeNode.title}</span>
          <button
            className={`${styles.statusBadge} ${statusClass}`}
            onClick={cycleStatus}
            title="Click to cycle: draft → revised → final"
          >
            {activeNode.status}
          </button>
        </div>
        <div className={styles.metaGroup}>
          {activeStory && (
            <SceneThreadBadges storyId={activeStory.id} nodeId={activeNode.id} />
          )}
          <span className={styles.wordCount}>{wordCount.toLocaleString()} words</span>
          <button
            onClick={() => setShowOverview((s) => !s)}
            className={`${styles.topbarBtn} ${showOverview ? styles.topbarBtnActive : ""}`}
            title="Synopsis &amp; purpose"
          >
            <FileText size={13} />
            <span>Notes</span>
          </button>
          {activeStory && (
            <button
              onClick={() => setShowSummary((s) => !s)}
              className={styles.topbarBtn}
              title="Story So Far — AI summary of the story up to this point"
            >
              <BookOpen size={13} />
              <span>Story So Far</span>
            </button>
          )}
          <button
            onClick={toggleFocusMode}
            className={styles.focusBtn}
            title={focusMode ? "Exit focus mode" : "Focus mode"}
          >
            {focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {showOverview && (
        <div className={styles.overviewPanel}>
          <div className={styles.overviewField}>
            <label className={styles.overviewLabel}>Synopsis</label>
            <textarea
              value={synopsis}
              onChange={(e) => {
                setSynopsis(e.target.value);
                scheduleOverviewSave({ synopsis: e.target.value });
              }}
              placeholder="Brief summary of what happens in this segment…"
              className={styles.overviewTextarea}
              rows={2}
            />
          </div>
          <div className={styles.overviewField}>
            <label className={styles.overviewLabel}>Purpose</label>
            <textarea
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value);
                scheduleOverviewSave({ metadata_: { purpose: e.target.value } });
              }}
              placeholder="Why does this segment exist? What narrative function does it serve?"
              className={styles.overviewTextarea}
              rows={2}
            />
            <p className={styles.overviewHint}>Consider: Where are things at the start? Where should they be at the end? What key events need to happen?</p>
          </div>
          <div className={styles.overviewField}>
            <label className={styles.overviewLabel}>Entry State</label>
            <textarea
              value={entryState}
              onChange={(e) => setEntryState(e.target.value)}
              onBlur={async () => {
                if (!activeNode) return;
                const updated = await api.updateNode(activeNode.id, { entry_state: entryState });
                setActiveNode({ ...activeNode, ...updated });
              }}
              placeholder="Who is Maya before this scene begins? What does she believe?"
              className={styles.overviewTextarea}
              rows={2}
            />
          </div>
          <div className={styles.overviewField}>
            <label className={styles.overviewLabel}>Exit State</label>
            <textarea
              value={exitState}
              onChange={(e) => setExitState(e.target.value)}
              onBlur={async () => {
                if (!activeNode) return;
                const updated = await api.updateNode(activeNode.id, { exit_state: exitState });
                setActiveNode({ ...activeNode, ...updated });
              }}
              placeholder="How has the character or situation changed by the end of this scene?"
              className={styles.overviewTextarea}
              rows={2}
            />
          </div>
          <div className={styles.overviewField}>
            <label className={styles.overviewLabel}>Key Events</label>
            <textarea
              value={keyEvents}
              onChange={(e) => setKeyEvents(e.target.value)}
              onBlur={async () => {
                if (!activeNode) return;
                const updated = await api.updateNode(activeNode.id, { key_events: keyEvents });
                setActiveNode({ ...activeNode, ...updated });
              }}
              placeholder="What must happen in this scene? List the pivotal moments or turning points."
              className={styles.overviewTextarea}
              rows={2}
            />
          </div>
          <div className={styles.overviewField}>
            <div className={styles.linkedHeader}>
              <label className={styles.overviewLabel}>Linked Scenes</label>
              <button className={styles.addLinkBtn} onClick={() => setShowAddLink(true)}>
                <Plus size={11} />
                Add Link
              </button>
            </div>
            {sceneLinks.length === 0 ? (
              <p className={styles.overviewHint}>No scene links yet.</p>
            ) : (
              <div className={styles.linkChips}>
                {sceneLinks.map(link => {
                  const isForward = link.source_node_id === activeNode.id;
                  const linkedNodeId = isForward ? link.target_node_id : link.source_node_id;
                  const linkedNode = findNode(linkedNodeId);
                  const label = getLinkLabel(link, isForward);
                  return (
                    <div key={link.id} className={styles.linkChip} title={link.note || undefined}>
                      <button
                        className={styles.linkChipContent}
                        onClick={() => handleNavigateToLink(link)}
                      >
                        <span className={styles.linkChipLabel}>{label}</span>
                        <span className={styles.linkChipTitle}>{linkedNode?.title ?? "Unknown scene"}</span>
                      </button>
                      <button
                        className={styles.linkChipDelete}
                        onClick={() => handleDeleteLink(link.id)}
                        title="Remove link"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showSummary && activeStory && (
        <div className={styles.summaryWrap}>
          <StorySummaryPanel storyId={activeStory.id} />
        </div>
      )}

      <div className={styles.scrollArea}>
        <div className={styles.editorWrap}>
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Add Link modal */}
      {showAddLink && (
        <div className={styles.modalOverlay} onClick={() => setShowAddLink(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Add Scene Link</span>
              <button className={styles.modalClose} onClick={() => setShowAddLink(false)}>
                <X size={14} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Target Scene</label>
                <input
                  type="text"
                  placeholder="Search scenes…"
                  value={addLinkSearch}
                  onChange={e => setAddLinkSearch(e.target.value)}
                  className={styles.modalInput}
                  autoFocus
                />
                <div className={styles.nodeList}>
                  {flatNodes
                    .filter(n =>
                      n.id !== activeNode.id &&
                      n.title.toLowerCase().includes(addLinkSearch.toLowerCase())
                    )
                    .map(n => (
                      <button
                        key={n.id}
                        className={`${styles.nodeListItem} ${addLinkTarget?.id === n.id ? styles.nodeListItemSelected : ""}`}
                        onClick={() => setAddLinkTarget(n)}
                      >
                        <span className={styles.nodeListType}>{n.level_type}</span>
                        {n.title}
                      </button>
                    ))}
                </div>
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Link Type</label>
                <select
                  value={addLinkType}
                  onChange={e => setAddLinkType(e.target.value)}
                  className={styles.modalSelect}
                >
                  {LINK_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.forward}</option>
                  ))}
                </select>
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Note (optional)</label>
                <textarea
                  value={addLinkNote}
                  onChange={e => setAddLinkNote(e.target.value)}
                  placeholder="Describe how these scenes connect…"
                  className={styles.modalTextarea}
                  rows={2}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancel} onClick={() => setShowAddLink(false)}>
                Cancel
              </button>
              <button
                className={styles.modalSave}
                onClick={handleCreateLink}
                disabled={!addLinkTarget}
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
