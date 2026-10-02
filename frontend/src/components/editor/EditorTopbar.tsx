import { createElement, useState } from "react";
import { Quote, StickyNote } from "lucide-react";
import { api } from "../../api/client";
import type { StructureNode } from "../../types";
import { useStoryStore } from "../../stores/storyStore";
import type { WritingGuideTab } from "../help/WritingGuidesModal";
import SceneThreadBadges from "../threads/SceneThreadBadges";
import SprintTimer from "../story/SprintTimer";
import { getSegmentIcon, segmentColor } from "./segmentMeta";
import type { AutosaveState } from "./useSceneAutosave";
import SaveStatusPill from "./SaveStatusPill";
import TodayCounter from "./TodayCounter";
import { useUIStore } from "../../stores/uiStore";
import EditorMoreMenu from "./EditorMoreMenu";
import PopoverMenu from "../common/PopoverMenu";
import type { NotesView } from "../../lib/notes/view";
import { toast } from "../../stores/toastStore";
import styles from "./SceneEditor.module.css";

interface Props {
  activeNode: StructureNode;
  wordCount: number;
  autosave: AutosaveState;
  /** How the scene's notes show beside the prose (doc 15), and how many are open. */
  notesView: NotesView;
  noteCount: number;
  onNotesView: (view: NotesView) => void;
  dialogueIsolation: boolean;
  onToggleDialogue: () => void;
  onOpenImagePicker: () => void;
  onOpenAutoTag: () => void;
  onOpenAutoLink: () => void;
  onOpenGuides: (tab: WritingGuideTab) => void;
}

const STATUSES: StructureNode["status"][] = ["planned", "draft", "revised", "final"];
const STATUS_LABEL: Record<string, string> = {
  planned: "Planned",
  draft: "Draft",
  revised: "Revised",
  final: "Final",
};

function segmentStyle(levelType: string) {
  const color = segmentColor(levelType);
  return {
    color,
    background: `color-mix(in srgb, ${color} 10%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
  };
}

export default function EditorTopbar(p: Props) {
  const { activeNode } = p;
  const { activeStory, activeTemplate, structure, setStructure, setActiveNode } = useStoryStore();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const sprintActive = useUIStore((st) => st.sprintActive);

  // A menu of the four states, not a blind cycle: "planned" was unreachable and going back
  // meant going round (doc 14 review). Failures say so instead of doing nothing.
  async function setStatus(status: StructureNode["status"]) {
    if (status === activeNode.status) return;
    try {
      const updated = await api.updateNode(activeNode.id, { status });
      setActiveNode({ ...activeNode, status: updated.status });
    } catch {
      toast.error("The status did not change. Try again in a moment.");
    }
  }

  // The type is what the node is (an Opening, a Try / Fail beat), not how deep it sits.
  // This used to be keyed by depth: in a Single MICE story, where every beat is at the
  // top level, every beat showed as "Opening", and choosing a type moved the node down
  // the tree. Depth is changed by moving the node; this only changes its type.
  async function changeType(levelType: string) {
    let updated: StructureNode;
    try {
      updated = await api.updateNode(activeNode.id, { level_type: levelType });
    } catch {
      toast.error("The type did not change. Try again in a moment.");
      return;
    }
    const patch = (nodes: StructureNode[]): StructureNode[] =>
      nodes.map((n) =>
        n.id === activeNode.id
          ? { ...n, level_type: levelType }
          : { ...n, children: patch(n.children ?? []) },
      );
    setStructure(patch(structure));
    setActiveNode({ ...activeNode, ...updated });
  }
  const typeOptions =
    activeTemplate?.levels.map((l) => ({ value: l.name.toLowerCase(), label: l.name })) ?? [];
  const currentType = activeNode.level_type.toLowerCase();

  async function saveTitle() {
    setEditingTitle(false);
    const trimmed = titleValue.trim();
    if (!trimmed || trimmed === activeNode.title) return;
    try {
      await api.updateNode(activeNode.id, { title: trimmed });
    } catch {
      toast.error("The title did not save. Try again in a moment.");
      return;
    }
    const patch = (nodes: StructureNode[]): StructureNode[] =>
      nodes.map((n) =>
        n.id === activeNode.id ? { ...n, title: trimmed } : { ...n, children: patch(n.children ?? []) },
      );
    setStructure(patch(structure));
    setActiveNode({ ...activeNode, title: trimmed });
  }

  const levelLabel = activeTemplate?.levels[activeNode.level]?.name ?? activeNode.level_type;
  const statusClass =
    activeNode.status === "final" ? styles.final : activeNode.status === "revised" ? styles.revised : "";
  return (
    <div className={styles.topbar}>
      <div className={styles.titleGroup}>
        {createElement(getSegmentIcon(activeNode.level_type), {
          size: 14,
          className: styles.typeIcon,
          style: { color: segmentColor(activeNode.level_type) },
        })}
        {activeTemplate ? (
          <select
            className={styles.typeSelect}
            style={segmentStyle(activeNode.level_type)}
            value={currentType}
            onChange={(e) => changeType(e.target.value)}
            title="Change segment type"
          >
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            {!typeOptions.some((o) => o.value === currentType) && (
              <option value={currentType}>{activeNode.level_type}</option>
            )}
          </select>
        ) : (
          <span className={styles.typeBadge} style={segmentStyle(activeNode.level_type)}>
            {levelLabel}
          </span>
        )}
        {editingTitle ? (
          <input
            className={styles.nodeTitleInput}
            value={titleValue}
            autoFocus
            onChange={(e) => setTitleValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveTitle();
              }
              if (e.key === "Escape") setEditingTitle(false);
            }}
            onBlur={saveTitle}
          />
        ) : (
          <button
            type="button"
            className={styles.nodeTitle}
            onClick={() => {
              setTitleValue(activeNode.title);
              setEditingTitle(true);
            }}
            title="Rename"
          >
            {activeNode.title}
          </button>
        )}
        <PopoverMenu
          label={`Status: ${STATUS_LABEL[activeNode.status] ?? activeNode.status}. Change it`}
          trigger={STATUS_LABEL[activeNode.status] ?? activeNode.status}
          triggerClassName={`${styles.statusBadge} ${statusClass}`}
          align="start"
          items={STATUSES.map((st) => ({ label: STATUS_LABEL[st], onSelect: () => void setStatus(st) }))}
        />
      </div>
      <div className={styles.metaGroup}>
        {activeStory && (
          <div className={styles.threadBadgesWrap}>
            <SceneThreadBadges storyId={activeStory.id} nodeId={activeNode.id} />
          </div>
        )}
        <span className={styles.wordCount}>
          {p.wordCount.toLocaleString()} words
          <TodayCounter
            storyId={p.activeNode.story_id}
            nodeId={p.activeNode.id}
            savedWords={p.activeNode.word_count ?? 0}
          />
        </span>
        <SaveStatusPill autosave={p.autosave} />
        <span className={styles.topbarRule} aria-hidden />
        <button
          onClick={() => p.onNotesView(p.notesView === "cards" ? "dots" : "cards")}
          className={`${styles.topbarBtn} ${p.notesView === "cards" ? styles.topbarBtnActive : ""}`}
          aria-pressed={p.notesView === "cards"}
          title={
            p.notesView === "cards"
              ? "Notes beside the text; click for dots"
              : "Notes as dots; click to show them beside the text"
          }
        >
          <StickyNote size={13} aria-hidden />
          <span>Notes{p.noteCount > 0 ? ` ${p.noteCount}` : ""}</span>
        </button>
        <button
          onClick={p.onToggleDialogue}
          className={`${styles.topbarBtn} ${p.dialogueIsolation ? styles.topbarBtnActive : ""}`}
          aria-pressed={p.dialogueIsolation}
          title="Dialogue view: show only the dialogue"
        >
          <Quote size={13} />
          <span>Dialogue</span>
        </button>
        {sprintActive && <SprintTimer currentWordCount={p.wordCount} />}
        <EditorMoreMenu
          wordCount={p.wordCount}
          sprintRunning={sprintActive}
          onInsertImage={p.onOpenImagePicker}
          onOpenGuides={p.onOpenGuides}
          onOpenAutoTag={p.onOpenAutoTag}
          onOpenAutoLink={p.onOpenAutoLink}
        />
      </div>
    </div>
  );
}
