import { useEffect, useRef, useState } from "react";
import type { StructureNode } from "../../types";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Typography from "@tiptap/extension-typography";
import { Maximize2, Minimize2, BookOpen, FileText, Flag, BookMarked, Clapperboard, Layers, Zap, Puzzle, Milestone, type LucideIcon } from "lucide-react";

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
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import StorySummaryPanel from "./StorySummaryPanel";
import SceneThreadBadges from "../threads/SceneThreadBadges";
import styles from "./SceneEditor.module.css";

export default function SceneEditor() {
  const { activeNode, setActiveNode, activeStory, activeTemplate } = useStoryStore();
  const { focusMode, toggleFocusMode } = useUIStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overviewSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [synopsis, setSynopsis] = useState("");
  const [purpose, setPurpose] = useState("");

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
  }, [activeNode?.id]);

  function scheduleOverviewSave(patch: { synopsis?: string; metadata_?: { purpose?: string } }) {
    if (overviewSaveRef.current) clearTimeout(overviewSaveRef.current);
    overviewSaveRef.current = setTimeout(async () => {
      if (!activeNode) return;
      const updated = await api.updateNode(activeNode.id, patch);
      setActiveNode({ ...activeNode, ...updated });
    }, 900);
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
    </div>
  );
}
