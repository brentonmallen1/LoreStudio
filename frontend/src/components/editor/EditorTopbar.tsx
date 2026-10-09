import { createElement, useState } from "react";
import { api } from "../../api/client";
import type { StructureNode } from "../../types";
import { useStoryStore } from "../../stores/storyStore";
import type { WritingGuideTab } from "../help/WritingGuidesModal";
import SceneThreadBadges from "../threads/SceneThreadBadges";
import { getSegmentIcon, segmentColor } from "./segmentMeta";
import { useUIStore } from "../../stores/uiStore";
import EditorMoreMenu from "./EditorMoreMenu";
import PopoverMenu from "../common/PopoverMenu";
import type { NotesView } from "../../lib/notes/view";
import { toast } from "../../stores/toastStore";
import styles from "./SceneEditor.module.css";

interface Props {
  activeNode: StructureNode;
  wordCount: number;
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

/**
 * The page's sub header (doc 24): what the scene is and the ⋯ for what you can do with it.
 * It floats on the page with no ground or rule of its own: the type as its icon (a menu of
 * the template's types), the title, the status as a shape and a word, its threads, and ⋯.
 * The words and the save light are in the status corner; Notes and Dialogue are under ⋯.
 * In focus mode it goes quiet in colour, and comes back under the pointer or the keyboard.
 */
export default function EditorTopbar(p: Props) {
  const { activeNode } = p;
  const { activeStory, activeTemplate, structure, setStructure, setActiveNode } = useStoryStore();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const sprintActive = useUIStore((st) => st.sprintActive);
  const focused = useUIStore((st) => st.viewState === "focus");

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
    if (levelType === activeNode.level_type.toLowerCase()) return;
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

  const levelLabel =
    typeOptions.find((o) => o.value === currentType)?.label ??
    activeTemplate?.levels[activeNode.level]?.name ??
    activeNode.level_type;
  const typeIcon = createElement(getSegmentIcon(activeNode.level_type), { size: 17, "aria-hidden": true });
  const statusLabel = STATUS_LABEL[activeNode.status] ?? activeNode.status;
  return (
    <div className={styles.topbar} data-quiet={focused || undefined}>
      <div className={styles.titleGroup}>
        <span
          className={styles.typeMark}
          style={{ "--seg": segmentColor(activeNode.level_type) } as React.CSSProperties}
        >
          {typeOptions.length > 1 ? (
            <PopoverMenu
              label={`Type: ${levelLabel}. Change it`}
              trigger={typeIcon}
              triggerClassName={styles.typeBtn}
              align="start"
              items={[
                ...typeOptions.map((o) => ({
                  label: o.label,
                  checked: o.value === currentType,
                  onSelect: () => void changeType(o.value),
                })),
              ]}
            />
          ) : (
            <span className={styles.typeBtn} role="img" aria-label={levelLabel} title={levelLabel}>
              {typeIcon}
            </span>
          )}
        </span>
        {editingTitle ? (
          <input
            className={styles.nodeTitleInput}
            value={titleValue}
            autoFocus
            aria-label="Scene title"
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
            title={`${activeNode.title} (click to rename)`}
          >
            {activeNode.title}
          </button>
        )}
        <PopoverMenu
          label={`Status: ${statusLabel}. Change it`}
          trigger={
            <>
              <span
                className={`${styles.statusShape} ${styles[`status_${activeNode.status}`] ?? ""}`}
                aria-hidden
              />
              {statusLabel}
            </>
          }
          triggerClassName={styles.statusBadge}
          align="start"
          items={STATUSES.map((st) => ({
            label: STATUS_LABEL[st],
            checked: st === activeNode.status,
            onSelect: () => void setStatus(st),
          }))}
        />
        {activeStory && (
          <div className={styles.threadBadgesWrap}>
            <SceneThreadBadges storyId={activeStory.id} nodeId={activeNode.id} />
          </div>
        )}
      </div>
      <div className={styles.metaGroup}>
        <EditorMoreMenu
          wordCount={p.wordCount}
          sprintRunning={sprintActive}
          onInsertImage={p.onOpenImagePicker}
          onOpenGuides={p.onOpenGuides}
          onOpenAutoTag={p.onOpenAutoTag}
          onOpenAutoLink={p.onOpenAutoLink}
          notesView={p.notesView}
          noteCount={p.noteCount}
          onNotesView={p.onNotesView}
          dialogueIsolation={p.dialogueIsolation}
          onToggleDialogue={p.onToggleDialogue}
        />
      </div>
    </div>
  );
}
