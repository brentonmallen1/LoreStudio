import { createElement, useEffect, useRef, useState } from "react";
import {
  BookMarked,
  BookOpen,
  Compass,
  FileText,
  ImageIcon,
  Layers,
  Link,
  Map as MapIcon,
  Quote,
  Tag,
} from "lucide-react";
import { api } from "../../api/client";
import type { StructureNode } from "../../types";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import type { WritingGuideTab } from "../help/WritingGuidesModal";
import SceneThreadBadges from "../threads/SceneThreadBadges";
import SprintTimer from "../story/SprintTimer";
import FontPicker from "../story/FontPicker";
import AIFeatureInfoTrigger from "../ai/AIFeatureInfoTrigger";
import { getSegmentIcon, segmentColor } from "./segmentMeta";
import type { AutosaveState } from "./useSceneAutosave";
import SaveStatusPill from "./SaveStatusPill";
import { useMode } from "../../lib/mode";
import styles from "./SceneEditor.module.css";

interface Props {
  activeNode: StructureNode;
  wordCount: number;
  autosave: AutosaveState;
  showOverview: boolean;
  onToggleOverview: () => void;
  dialogueIsolation: boolean;
  onToggleDialogue: () => void;
  onToggleSummary: () => void;
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
  const {
    brainstormPanelOpen,
    openBrainstormPanel,
    closeBrainstormPanel,
    plannerPanelOpen,
    openPlannerPanel,
    closePlannerPanel,
  } = useUIStore();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const studio = useMode() === "studio";
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

  async function changeType(levelIdx: number) {
    const lvl = activeTemplate?.levels[levelIdx];
    if (!lvl) return;
    const updated = await api.updateNode(activeNode.id, {
      level_type: lvl.name.toLowerCase(),
      level: levelIdx,
    });
    setActiveNode({ ...activeNode, ...updated });
  }

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
            value={activeNode.level}
            onChange={(e) => changeType(Number(e.target.value))}
            title="Change segment type"
          >
            {activeTemplate.levels.map((lvl, idx) => (
              <option key={idx} value={idx}>
                {lvl.name}
              </option>
            ))}
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
          title="Click to cycle: draft → revised → final"
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
        <span className={styles.wordCount}>{p.wordCount.toLocaleString()} words</span>
        <SaveStatusPill autosave={p.autosave} />
        <button
          onClick={p.onOpenImagePicker}
          className={styles.topbarBtn}
          title="Insert image into prose (⌘⇧I)"
        >
          <ImageIcon size={13} />
        </button>
        <button
          onClick={p.onToggleOverview}
          className={`${styles.topbarBtn} ${p.showOverview ? styles.topbarBtnActive : ""}`}
          title="Synopsis &amp; purpose"
        >
          <FileText size={13} />
          <span>Notes</span>
        </button>
        {activeStory && (
          <div className={styles.guideMenuWrap} ref={guideRef}>
            <button
              onClick={() => setGuideOpen((v) => !v)}
              className={`${styles.topbarBtn} ${studio ? styles.topbarBtnAI : ""} ${guideOpen || plannerPanelOpen || brainstormPanelOpen ? (studio ? styles.topbarBtnAIActive : styles.topbarBtnActive) : ""}`}
              title={
                studio
                  ? "AI writing guides — Story So Far, Plan Scene, What's Next?"
                  : "Writing reference guides"
              }
            >
              {studio ? <Compass size={13} /> : <BookOpen size={13} />}
              <span>Guide</span>
            </button>
            {guideOpen && (
              <div className={styles.guideMenu}>
                {studio &&
                  [
                    {
                      label: "Story So Far",
                      icon: <BookOpen size={13} />,
                      title: "AI summary of the story up to this point",
                      run: p.onToggleSummary,
                    },
                    {
                      label: "Plan Scene",
                      icon: <MapIcon size={13} />,
                      title: "Plan this scene before writing",
                      run: () => (plannerPanelOpen ? closePlannerPanel() : openPlannerPanel()),
                      active: plannerPanelOpen,
                    },
                    {
                      label: "What's Next?",
                      icon: <Compass size={13} />,
                      title: "Brainstorm directions for this scene",
                      run: () => (brainstormPanelOpen ? closeBrainstormPanel() : openBrainstormPanel()),
                      active: brainstormPanelOpen,
                    },
                  ].map((item) => (
                    <GuideItem
                      key={item.label}
                      label={item.label}
                      icon={item.icon}
                      title={item.title}
                      active={item.active}
                      onSelect={() => {
                        item.run();
                        setGuideOpen(false);
                      }}
                    />
                  ))}
                {studio && <div className={styles.guideMenuDivider} />}
                <div className={styles.guideMenuLabel}>Reference</div>
                {[
                  {
                    label: "Dialogue Guide",
                    icon: <Quote size={13} />,
                    title: "Learn how to attribute dialogue to characters",
                    run: () => p.onOpenGuides("dialogue"),
                  },
                  {
                    label: "MICE Guide",
                    icon: <Layers size={13} />,
                    title: "Understand the MICE Quotient — Milieu, Idea, Character, Event",
                    run: () => p.onOpenGuides("mice"),
                  },
                  {
                    label: "6 Essential Questions",
                    icon: <BookMarked size={13} />,
                    title: "The 6 Essential Questions every story needs to answer",
                    run: () => p.onOpenGuides("essential"),
                  },
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
                ].map((item) => (
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
            )}
          </div>
        )}
        <button
          onClick={p.onToggleDialogue}
          className={`${styles.topbarBtn} ${p.dialogueIsolation ? styles.topbarBtnActive : ""}`}
          title="Dialogue view — show only attributed dialogue (toggle)"
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
