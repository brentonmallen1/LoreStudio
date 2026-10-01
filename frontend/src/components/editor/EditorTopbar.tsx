import { createElement, useEffect, useRef, useState } from "react";
import {
  BookMarked,
  BookOpen,
  Columns3,
  ImageIcon,
  Layers,
  Link,
  Quote,
  StickyNote,
  Tag,
} from "lucide-react";
import { useSides } from "../../lib/layout/useSides";
import { api } from "../../api/client";
import type { StructureNode } from "../../types";
import { useStoryStore } from "../../stores/storyStore";
import type { WritingGuideTab } from "../help/WritingGuidesModal";
import SceneThreadBadges from "../threads/SceneThreadBadges";
import SprintTimer from "../story/SprintTimer";
import FontPicker from "../story/FontPicker";
import AIFeatureInfoTrigger from "../ai/AIFeatureInfoTrigger";
import { SHORTCUTS, formatCombo } from "../../lib/keyboard/shortcuts";
import { getSegmentIcon, segmentColor } from "./segmentMeta";
import type { AutosaveState } from "./useSceneAutosave";
import SaveStatusPill from "./SaveStatusPill";
import TodayCounter from "./TodayCounter";
import { useAIAvailable } from "../../lib/mode";
import styles from "./SceneEditor.module.css";

interface Props {
  activeNode: StructureNode;
  wordCount: number;
  autosave: AutosaveState;
  /** The notes margin beside the prose (doc 13 P2), and how many notes the scene has. */
  showNotes: boolean;
  noteCount: number;
  onToggleNotes: () => void;
  dialogueIsolation: boolean;
  onToggleDialogue: () => void;
  onOpenImagePicker: () => void;
  onOpenAutoTag: () => void;
  onOpenAutoLink: () => void;
  onOpenGuides: (tab: WritingGuideTab) => void;
}

const STATUS_CYCLE: StructureNode["status"][] = ["draft", "revised", "final"];

function GuideItem({
  label,
  icon,
  title,
  active = false,
  onSelect,
}: {
  label: string;
  icon: React.ReactNode;
  title: string;
  active?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`${styles.guideMenuItem} ${active ? styles.guideMenuItemActive : ""}`}
      title={title}
    >
      {icon}
      {label}
    </button>
  );
}

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
  const [guideOpen, setGuideOpen] = useState(false);
  const studio = useAIAvailable();
  const sides = useSides();
  const guideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!guideOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (guideRef.current && !guideRef.current.contains(e.target as Node)) setGuideOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [guideOpen]);

  async function cycleStatus() {
    const idx = STATUS_CYCLE.indexOf(activeNode.status);
    const updated = await api.updateNode(activeNode.id, {
      status: STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length],
    });
    setActiveNode({ ...activeNode, status: updated.status });
  }

  // The type is what the node is (an Opening, a Try / Fail beat), not how deep it sits.
  // This used to be keyed by depth: in a Single MICE story, where every beat is at the
  // top level, every beat showed as "Opening", and choosing a type moved the node down
  // the tree. Depth is changed by moving the node; this only changes its type.
  async function changeType(levelType: string) {
    const updated = await api.updateNode(activeNode.id, { level_type: levelType });
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
    await api.updateNode(activeNode.id, { title: trimmed });
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
          <span
            className={styles.nodeTitle}
            onClick={() => {
              setTitleValue(activeNode.title);
              setEditingTitle(true);
            }}
            title="Click to rename"
          >
            {activeNode.title}
          </span>
        )}
        <button
          className={`${styles.statusBadge} ${statusClass}`}
          onClick={cycleStatus}
          title={
            activeNode.status === "planned"
              ? "Planned: becomes a draft when you start writing (or click)"
              : "Click to cycle: draft → revised → final"
          }
        >
          {activeNode.status}
        </button>
      </div>
      <div className={styles.metaGroup}>
        {activeStory && (
          <div className={styles.threadBadgesWrap}>
            <SceneThreadBadges storyId={activeStory.id} nodeId={activeNode.id} />
          </div>
        )}
        <TodayCounter
          storyId={p.activeNode.story_id}
          nodeId={p.activeNode.id}
          savedWords={p.activeNode.word_count ?? 0}
        />
        <span className={styles.wordCount}>{p.wordCount.toLocaleString()} words</span>
        <SaveStatusPill autosave={p.autosave} />
        <button
          onClick={p.onOpenImagePicker}
          className={styles.topbarBtn}
          title={`Insert image into prose (${formatCombo(SHORTCUTS.insertImage.combo)})`}
        >
          <ImageIcon size={13} />
        </button>
        <button
          onClick={p.onToggleNotes}
          className={`${styles.topbarBtn} ${p.showNotes ? styles.topbarBtnActive : ""}`}
          aria-pressed={p.showNotes}
          aria-label="Notes in the margin"
          title={p.showNotes ? "Hide the notes margin" : "Show notes in the margin"}
        >
          <StickyNote size={13} />
          <span>Notes{p.noteCount > 0 ? ` ${p.noteCount}` : ""}</span>
        </button>
        <button
          onClick={sides.toggle}
          className={`${styles.topbarBtn} ${sides.collapsed ? styles.topbarBtnActive : ""}`}
          aria-pressed={sides.collapsed}
          aria-label={sides.collapsed ? "Restore both sides" : "Collapse both sides"}
          title={`${sides.collapsed ? "Restore both sides" : "Collapse both sides"} (${formatCombo(SHORTCUTS.collapseSides.combo)})`}
        >
          <Columns3 size={13} />
          <span>{sides.collapsed ? "Restore sides" : "Collapse sides"}</span>
        </button>
        {activeStory && (
          <div className={styles.guideMenuWrap} ref={guideRef}>
            <button
              onClick={() => setGuideOpen((v) => !v)}
              className={`${styles.topbarBtn} ${guideOpen ? styles.topbarBtnActive : ""}`}
              title="Writing guides and scene tools"
            >
              <BookOpen size={13} />
              <span>Guide</span>
            </button>
            {guideOpen && (
              <div className={styles.guideMenu}>
                {/* Guides to read, then tools that scan this scene: they were one list
                    headed "Reference", which the tools are not. */}
                {[
                  {
                    heading: "Guides",
                    items: [
                      {
                        label: "Dialogue Guide",
                        icon: <Quote size={13} />,
                        title: "Learn how to attribute dialogue to characters",
                        run: () => p.onOpenGuides("dialogue"),
                      },
                      {
                        label: "MICE Guide",
                        icon: <Layers size={13} />,
                        title: "Understand the MICE Quotient: Milieu, Idea, Character, Event",
                        run: () => p.onOpenGuides("mice"),
                      },
                      {
                        label: "6 Essential Questions",
                        icon: <BookMarked size={13} />,
                        title: "The 6 Essential Questions every story needs to answer",
                        run: () => p.onOpenGuides("essential"),
                      },
                    ],
                  },
                  {
                    heading: "Tools for this scene",
                    items: [
                      {
                        label: "Tag Suggestions",
                        icon: <Tag size={13} />,
                        title: "Scan for untagged quotes and propose speaker attribution",
                        run: p.onOpenAutoTag,
                      },
                      {
                        label: "Link Mentions",
                        icon: <Link size={13} />,
                        title: "Scan for unlinked character and location mentions",
                        run: p.onOpenAutoLink,
                      },
                    ],
                  },
                ].map((group) => (
                  <div key={group.heading}>
                    <div className={styles.guideMenuLabel}>{group.heading}</div>
                    {group.items.map((item) => (
                      <GuideItem
                        key={item.label}
                        label={item.label}
                        icon={item.icon}
                        title={item.title}
                        onSelect={() => {
                          item.run();
                          setGuideOpen(false);
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          onClick={p.onToggleDialogue}
          className={`${styles.topbarBtn} ${p.dialogueIsolation ? styles.topbarBtnActive : ""}`}
          title="Dialogue view: show only the dialogue (toggle)"
        >
          <Quote size={13} />
          <span>Dialogue</span>
        </button>
        <div className={styles.sprintTimerWrap}>
          <SprintTimer currentWordCount={p.wordCount} />
        </div>
        <FontPicker />
        {studio && <AIFeatureInfoTrigger pageId="scene-editor" size="sm" />}
      </div>
    </div>
  );
}
