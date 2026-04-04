import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { StructureNode, SceneLink, InlineNote, Setting, SceneSetting, Location } from "../../types";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Typography from "@tiptap/extension-typography";
import { BookOpen, FileText, Flag, BookMarked, Clapperboard, Layers, Zap, Puzzle, Milestone, Plus, X, Trash2, Sparkles, type LucideIcon } from "lucide-react";
import { InlineNoteExtension, setInlineNoteCallbacks } from "./InlineNoteExtension";
import {
  MentionDropdownExtension,
  setMentionItems,
  setMentionCallbacks,
  setMentionIsOpen,
  FORCE_MENTION_KEY,
  type MentionItem,
} from "./MentionDropdown";
import AssetPicker from "../media/AssetPicker";

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
import SprintTimer from "./SprintTimer";
import FontPicker from "./FontPicker";
import SceneChatPanel from "../layout/SceneChatPanel";
import { useLLMStream } from "../../hooks/useLLMStream";
import styles from "./SceneEditor.module.css";

export default function SceneEditor() {
  const { activeNode, setActiveNode, activeStory, activeTemplate, structure, characters } = useStoryStore();
  const { chatPanelOpen, openChatPanel, closeChatPanel } = useUIStore();
  const navigate = useNavigate();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overviewSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "unsaved" | "saving" | "saved">("idle");
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [synopsis, setSynopsis] = useState("");
  const [purpose, setPurpose] = useState("");
  const [entryState, setEntryState] = useState("");
  const [exitState, setExitState] = useState("");
  const [keyEvents, setKeyEvents] = useState("");
  const [contentSummary, setContentSummary] = useState("");

  // Scene settings (location links) state
  const [sceneSettings, setSceneSettings] = useState<SceneSetting[]>([]);
  const [flatLocations, setFlatLocations] = useState<Location[]>([]);
  const [addSettingId, setAddSettingId] = useState("");
  const [addSettingRole, setAddSettingRole] = useState("primary");

  // Scene links state
  const [sceneLinks, setSceneLinks] = useState<SceneLink[]>([]);
  const [showAddLink, setShowAddLink] = useState(false);
  const [addLinkType, setAddLinkType] = useState("foreshadowing");
  const [addLinkNote, setAddLinkNote] = useState("");
  const [addLinkTarget, setAddLinkTarget] = useState<StructureNode | null>(null);
  const [addLinkSearch, setAddLinkSearch] = useState("");

  // Inline notes state
  const [inlineNotes, setInlineNotes] = useState<InlineNote[]>([]);
  type NotePopover =
    | { open: false }
    | { open: true; isNew: true; from: number; to: number; anchor: string; rect: DOMRect | null }
    | { open: true; isNew: false; noteId: string; rect: DOMRect | null };
  const [notePopover, setNotePopover] = useState<NotePopover>({ open: false });
  const [noteInputText, setNoteInputText] = useState("");

  // @mention autocomplete state
  const [mentionAllItems, setMentionAllItems] = useState<MentionItem[]>([]);
  const [mentionOpen, setMentionOpen_] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPos, setMentionPos] = useState({ bottom: 0, left: 0 });
  const [mentionSelIdx, setMentionSelIdx] = useState(0);
  // Refs for stable access inside ProseMirror callbacks
  const mentionQueryRef = useRef("");
  const mentionSelIdxRef = useRef(0);
  const filteredMentionRef = useRef<MentionItem[]>([]);
  const doInsertMentionRef = useRef<((item: MentionItem) => void) | null>(null);

  // Full settings list (for hover card excerpts)
  const [settingsList, setSettingsList] = useState<Setting[]>([]);

  // Mention hover card
  type HoverCard =
    | { open: false }
    | {
        open: true;
        type: "character" | "setting";
        name: string;
        found: boolean;
        entityId: string;
        roleOrLabel: string;
        excerpt: string;
        rect: DOMRect;
      };
  const [hoverCard, setHoverCard] = useState<HoverCard>({ open: false });
  const hoverShowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const hoverCardRef = useRef<HTMLDivElement>(null);
  // Refs so event listeners (stable, empty-deps) always read fresh data
  const charactersRef = useRef(characters);
  const settingsListRef = useRef<Setting[]>([]);
  charactersRef.current = characters;
  settingsListRef.current = settingsList;

  function setMentionOpen(open: boolean) {
    setMentionOpen_(open);
    setMentionIsOpen(open);
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Begin writing…" }),
      CharacterCount,
      Typography,
      InlineNoteExtension,
      MentionDropdownExtension,
    ],
    content: activeNode?.content ?? "",
    onUpdate: ({ editor }) => {
      if (!activeNode) return;
      const content = editor.getHTML();
      setSaveState("unsaved");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        setSaveState("saving");
        const count = editor.storage.characterCount?.words() ?? 0;
        const updated = await api.updateNode(activeNode.id, { content, word_count: count });
        setActiveNode({ ...activeNode, content, word_count: updated.word_count });
        setSaveState("saved");
        if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
        savedTimeoutRef.current = setTimeout(() => setSaveState("idle"), 2000);
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

  // Subscribe to editor updates for live word count (seeded from activeNode.word_count)
  useEffect(() => {
    if (!editor) return;
    // Don't read immediately — word count is seeded from activeNode.word_count in the other effect.
    // CharacterCount extension isn't reliable at mount time anyway.
    const update = () => {
      const text = editor.state.doc.textContent;
      const count = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
      setWordCount(count);
    };
    editor.on("update", update);
    return () => { editor.off("update", update); };
  }, [editor]);

  useEffect(() => {
    if (!activeNode) return;
    setSynopsis(activeNode.synopsis ?? "");
    setPurpose(activeNode.metadata_?.purpose ?? "");
    setEntryState(activeNode.entry_state ?? "");
    setExitState(activeNode.exit_state ?? "");
    setKeyEvents(activeNode.key_events ?? "");
    setContentSummary(activeNode.content_summary ?? "");
    setInlineNotes(activeNode.metadata_?.inline_notes ?? []);
    setNotePopover({ open: false });
    // Seed word count from stored value; editor's onUpdate will keep it live
    setWordCount(activeNode.word_count ?? 0);
  }, [activeNode?.id]);

  const { stream: streamSummary, text: summaryStreamText, isStreaming: generatingSummary } = useLLMStream({
    requestId: activeNode ? `scene-summary:${activeNode.id}` : "scene-summary:none",
    label: "Summarizing scene",
    onComplete: (full) => {
      setContentSummary(full);
      if (activeNode) {
        setActiveNode({ ...activeNode, content_summary: full, summary_stale: false });
      }
    },
  });

  // Load scene links when active node changes
  useEffect(() => {
    if (!activeNode) { setSceneLinks([]); return; }
    api.getSceneLinks({ node_id: activeNode.id }).then(setSceneLinks).catch(() => {});
  }, [activeNode?.id]);

  // Load scene settings (location links) when active node/story changes
  useEffect(() => {
    if (!activeNode || !activeStory) { setSceneSettings([]); return; }
    api.getSceneSettingsForNode(activeNode.id).then(setSceneSettings).catch(() => {});
  }, [activeNode?.id]);

  useEffect(() => {
    if (!activeStory) { setFlatLocations([]); return; }
    api.listLocationsFlat(activeStory.id).then(setFlatLocations).catch(() => {});
  }, [activeStory?.id]);

  // Load characters and settings for @mention autocomplete
  useEffect(() => {
    if (!activeStory) { setMentionAllItems([]); setMentionItems([]); setSettingsList([]); return; }
    Promise.all([
      api.listCharacters(activeStory.id),
      api.listSettings(activeStory.id),
    ]).then(([chars, settings_]) => {
      const items: MentionItem[] = [
        ...chars.map((c) => ({ type: "character" as const, name: c.name, role: c.role })),
        ...settings_.map((s) => ({ type: "setting" as const, name: s.name })),
      ];
      setMentionAllItems(items);
      setMentionItems(items);
      setSettingsList(settings_);
      // Force decoration rebuild after items are loaded
      if (editor?.view) {
        editor.view.dispatch(editor.state.tr.setMeta(FORCE_MENTION_KEY, true));
      }
    }).catch(() => {});
  }, [activeStory?.id]);

  // Force decoration rebuild when editor becomes ready and items exist
  useEffect(() => {
    if (editor?.view && mentionAllItems.length > 0) {
      setMentionItems(mentionAllItems);
      editor.view.dispatch(editor.state.tr.setMeta(FORCE_MENTION_KEY, true));
    }
  }, [editor]);


  // Filtered mention items (characters first, then settings; prefix-matched)
  const filteredMentionItems = useMemo(
    () =>
      mentionAllItems.filter((item) =>
        item.name.toLowerCase().startsWith(mentionQuery.toLowerCase())
      ),
    [mentionAllItems, mentionQuery]
  );

  // Keep refs in sync with latest state (for stable ProseMirror callbacks)
  mentionQueryRef.current = mentionQuery;
  mentionSelIdxRef.current = mentionSelIdx;
  filteredMentionRef.current = filteredMentionItems;

  // Reset selection index when filtered list changes
  useEffect(() => {
    setMentionSelIdx(0);
  }, [mentionQuery]);

  const doInsertMention = useCallback(
    (item: MentionItem) => {
      if (!editor) return;
      const { from } = editor.state.selection;
      const query = mentionQueryRef.current;
      const start = from - query.length - 1; // -1 for the @ character
      const text =
        item.type === "character" ? `@${item.name}` : `[[${item.name}]]`;
      editor
        .chain()
        .focus()
        .command(({ tr, dispatch }) => {
          if (dispatch) tr.insertText(text, start, from);
          return true;
        })
        .run();
      setMentionOpen(false);
      setMentionSelIdx(0);
    },
    [editor]
  );

  // Keep doInsertMentionRef current (used by Enter keyboard path)
  useEffect(() => {
    doInsertMentionRef.current = doInsertMention;
  }, [doInsertMention]);

  // Wire up mention callbacks (stable — reads from refs)
  useEffect(() => {
    setMentionCallbacks({
      onOpen: (query, bottom, left) => {
        setMentionQuery(query);
        setMentionPos({ bottom, left });
        setMentionOpen_(true);
        setMentionIsOpen(true);
        setMentionSelIdx(0);
        mentionSelIdxRef.current = 0;
      },
      onClose: () => {
        setMentionOpen_(false);
        setMentionIsOpen(false);
      },
      onArrowDown: () => {
        setMentionSelIdx((i) => {
          const next = Math.min(i + 1, filteredMentionRef.current.length - 1);
          mentionSelIdxRef.current = next;
          return next;
        });
      },
      onArrowUp: () => {
        setMentionSelIdx((i) => {
          const next = Math.max(i - 1, 0);
          mentionSelIdxRef.current = next;
          return next;
        });
      },
      onEnterSelect: () => {
        const items = filteredMentionRef.current;
        const idx = mentionSelIdxRef.current;
        const item = items[Math.min(idx, items.length - 1)];
        if (item && doInsertMentionRef.current) {
          doInsertMentionRef.current(item);
        }
      },
    });
  }, []); // stable — refs handle freshness


  // Hover card event delegation — stable listener that reads from refs
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;

    function handleMouseOver(e: MouseEvent) {
      const target = (e.target as Element).closest(
        ".mention-char, .mention-setting, .mention-missing"
      ) as HTMLElement | null;
      if (!target) return;

      if (hoverShowTimer.current) clearTimeout(hoverShowTimer.current);
      if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);

      hoverShowTimer.current = setTimeout(() => {
        const name = target.getAttribute("data-mention-name") ?? "";
        const type = (target.getAttribute("data-mention-type") ?? "character") as
          | "character"
          | "setting";
        const rect = target.getBoundingClientRect();

        if (type === "character") {
          const char = charactersRef.current.find((c) => c.name === name);
          if (char) {
            const raw = char.personality || char.motivation || "";
            const excerpt = raw.slice(0, 120).trim() + (raw.length > 120 ? "…" : "");
            setHoverCard({
              open: true, type, name, found: true,
              entityId: char.id, roleOrLabel: char.role || "Character", excerpt, rect,
            });
          } else {
            setHoverCard({ open: true, type, name, found: false, entityId: "", roleOrLabel: "", excerpt: "", rect });
          }
        } else {
          const setting = settingsListRef.current.find((s) => s.name === name);
          if (setting) {
            const raw = setting.description || "";
            const excerpt = raw.slice(0, 120).trim() + (raw.length > 120 ? "…" : "");
            setHoverCard({
              open: true, type, name, found: true,
              entityId: setting.id, roleOrLabel: "Setting", excerpt, rect,
            });
          } else {
            setHoverCard({ open: true, type, name, found: false, entityId: "", roleOrLabel: "", excerpt: "", rect });
          }
        }
      }, 500);
    }

    function handleMouseOut(e: MouseEvent) {
      const target = (e.target as Element).closest(
        ".mention-char, .mention-setting, .mention-missing"
      ) as HTMLElement | null;
      if (!target) return;

      // Don't close if moving to the hover card
      if (hoverCardRef.current && hoverCardRef.current.contains(e.relatedTarget as Node)) return;

      if (hoverShowTimer.current) clearTimeout(hoverShowTimer.current);
      hoverCloseTimer.current = setTimeout(() => setHoverCard({ open: false }), 100);
    }

    el.addEventListener("mouseover", handleMouseOver);
    el.addEventListener("mouseout", handleMouseOut);
    return () => {
      el.removeEventListener("mouseover", handleMouseOver);
      el.removeEventListener("mouseout", handleMouseOut);
    };
  }, [activeNode]); // Re-run when activeNode loads so scrollAreaRef is available

  function scheduleOverviewSave(patch: { synopsis?: string; metadata_?: { purpose?: string } }) {
    if (overviewSaveRef.current) clearTimeout(overviewSaveRef.current);
    overviewSaveRef.current = setTimeout(async () => {
      if (!activeNode) return;
      const updated = await api.updateNode(activeNode.id, patch);
      setActiveNode({ ...activeNode, ...updated });
    }, 900);
  }

  // Inline note callbacks — kept current via module-level ref
  const handleNoteActivate = useCallback(
    (noteId: string, rect: DOMRect) => {
      setNotePopover({ open: true, isNew: false, noteId, rect });
    },
    []
  );

  const handleAddNote = useCallback(
    (from: number, to: number, anchor: string) => {
      const sel = window.getSelection();
      const rect =
        sel && sel.rangeCount > 0
          ? sel.getRangeAt(0).getBoundingClientRect()
          : null;
      setNotePopover({ open: true, isNew: true, from, to, anchor, rect });
      setNoteInputText("");
    },
    []
  );

  useEffect(() => {
    setInlineNoteCallbacks({
      onNoteActivate: handleNoteActivate,
      onAddNote: handleAddNote,
    });
  }, [handleNoteActivate, handleAddNote]);

  async function handleSaveNote() {
    if (!activeNode || !editor) return;
    if (!notePopover.open || !notePopover.isNew) return;
    const { from, to, anchor } = notePopover;
    const newNote: InlineNote = {
      id: crypto.randomUUID(),
      anchor,
      note: noteInputText.trim(),
      position: from,
    };
    editor.chain()
      .setTextSelection({ from, to })
      .setMark("inlineNote", { noteId: newNote.id })
      .run();
    const updated = [...inlineNotes, newNote];
    setInlineNotes(updated);
    setNotePopover({ open: false });
    try {
      const patched = await api.updateNode(activeNode.id, {
        metadata_: { ...activeNode.metadata_, inline_notes: updated },
      });
      setActiveNode({ ...activeNode, metadata_: patched.metadata_ });
    } catch { /* silently ignore */ }
  }

  async function handleDeleteNote(noteId: string) {
    if (!activeNode || !editor) return;
    // Remove mark from editor
    let markFrom: number | null = null;
    let markTo: number | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText) return;
      if (node.marks.some((m) => m.type.name === "inlineNote" && m.attrs.noteId === noteId)) {
        if (markFrom === null) markFrom = pos;
        markTo = pos + node.nodeSize;
      }
    });
    if (markFrom !== null && markTo !== null) {
      editor.chain()
        .setTextSelection({ from: markFrom, to: markTo })
        .unsetMark("inlineNote")
        .run();
    }
    const updated = inlineNotes.filter((n) => n.id !== noteId);
    setInlineNotes(updated);
    setNotePopover({ open: false });
    try {
      const patched = await api.updateNode(activeNode.id, {
        metadata_: { ...activeNode.metadata_, inline_notes: updated },
      });
      setActiveNode({ ...activeNode, metadata_: patched.metadata_ });
    } catch { /* silently ignore */ }
  }

  function scrollToNote(noteId: string) {
    if (!editor) return;
    let markFrom: number | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (markFrom !== null) return false;
      if (!node.isText) return;
      if (node.marks.some((m) => m.type.name === "inlineNote" && m.attrs.noteId === noteId)) {
        markFrom = pos;
      }
    });
    if (markFrom !== null) {
      const pos = markFrom;
      editor.chain().focus().setTextSelection(pos).scrollIntoView().run();
      setTimeout(() => {
        const el = document.querySelector(`[data-note-id="${noteId}"]`) as HTMLElement | null;
        if (el) {
          setNotePopover({ open: true, isNew: false, noteId, rect: el.getBoundingClientRect() });
        }
      }, 60);
    }
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
            <div className={styles.threadBadgesWrap}>
              <SceneThreadBadges storyId={activeStory.id} nodeId={activeNode.id} />
            </div>
          )}
          <span className={styles.wordCount}>{wordCount.toLocaleString()} words</span>
          <span
            className={`${styles.saveIndicator} ${styles[`saveIndicator_${activeNode ? saveState : "idle"}`]}`}
            title={saveState === "unsaved" ? "Unsaved changes" : saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
          />
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
              className={`${styles.topbarBtn} ${styles.topbarBtnAI}`}
              title="Story So Far — AI summary of the story up to this point"
            >
              <BookOpen size={13} />
              <span>Story So Far</span>
            </button>
          )}
          {activeStory && (
            <button
              onClick={() => chatPanelOpen ? closeChatPanel() : openChatPanel()}
              className={`${styles.topbarBtn} ${styles.topbarBtnAI} ${chatPanelOpen ? styles.topbarBtnAIActive : ""}`}
              title="Scene Assistant — AI chat grounded in this scene's full context"
            >
              <Sparkles size={13} />
              <span>Assistant</span>
            </button>
          )}
          <div className={styles.sprintTimerWrap}><SprintTimer currentWordCount={wordCount} /></div>
          <FontPicker />
        </div>
      </div>

      <div className={styles.contentRow}>
      <div className={styles.editorColumn}>

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
              <label className={styles.overviewLabel}>Settings</label>
              <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                <select
                  value={addSettingRole}
                  onChange={(e) => setAddSettingRole(e.target.value)}
                  style={{ fontSize: "0.72rem", fontFamily: "inherit", padding: "0.15rem 0.3rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-muted)", cursor: "pointer" }}
                >
                  <option value="primary">Primary</option>
                  <option value="mentioned">Mentioned</option>
                  <option value="flashback">Flashback</option>
                </select>
                <select
                  value={addSettingId}
                  onChange={(e) => setAddSettingId(e.target.value)}
                  style={{ fontSize: "0.72rem", fontFamily: "inherit", padding: "0.15rem 0.3rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-muted)", cursor: "pointer" }}
                >
                  <option value="">Add location…</option>
                  {flatLocations
                    .filter((loc) => !sceneSettings.some((s) => s.location_id === loc.id))
                    .map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                </select>
                <button
                  className={styles.addLinkBtn}
                  disabled={!addSettingId}
                  onClick={async () => {
                    if (!activeNode || !addSettingId) return;
                    const created = await api.addSceneSetting({
                      location_id: addSettingId,
                      node_id: activeNode.id,
                      role: addSettingRole,
                    });
                    setSceneSettings((prev) => [...prev, created]);
                    setAddSettingId("");
                  }}
                >
                  <Plus size={11} />
                </button>
              </div>
            </div>
            {sceneSettings.length === 0 ? (
              <p className={styles.overviewHint}>No locations linked to this scene yet.</p>
            ) : (
              <div className={styles.linkChips}>
                {sceneSettings.map((s) => {
                  const loc = flatLocations.find((l) => l.id === s.location_id);
                  return (
                    <div key={s.id} className={styles.linkChip}>
                      <span className={styles.linkChipContent} style={{ cursor: "default" }}>
                        {s.role !== "primary" && (
                          <span className={styles.linkChipLabel}>{s.role}</span>
                        )}
                        <span className={styles.linkChipTitle}>{loc?.name ?? s.location_id}</span>
                      </span>
                      <button
                        className={styles.linkChipDelete}
                        onClick={async () => {
                          await api.removeSceneSetting(s.id);
                          setSceneSettings((prev) => prev.filter((x) => x.id !== s.id));
                        }}
                        title="Remove location"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className={styles.overviewField}>
            <div className={styles.linkedHeader}>
              <label className={styles.overviewLabel}>
                AI Summary
                {activeNode && (
                  <span className={
                    !contentSummary && !summaryStreamText
                      ? styles.staleIndicatorNone
                      : activeNode.summary_stale
                      ? styles.staleIndicatorStale
                      : styles.staleIndicatorFresh
                  } title={
                    !contentSummary && !summaryStreamText ? "Not generated" : activeNode.summary_stale ? "Stale — content has changed" : "Fresh"
                  } />
                )}
                {activeNode?.summary_stale && contentSummary && (
                  <span className={styles.staleBadge}>Stale</span>
                )}
              </label>
              <button
                className={styles.summaryRefreshBtn}
                onClick={() => {
                  if (!activeNode) return;
                  streamSummary((signal) => api.summarizeNode(activeNode.id, signal));
                }}
                disabled={generatingSummary || !activeNode?.content?.trim()}
                title="Generate/Refresh summary"
              >
                <Sparkles size={11} />
                {!contentSummary && !summaryStreamText ? "Generate" : generatingSummary ? "Generating…" : "Regenerate"}
              </button>
            </div>
            {generatingSummary && summaryStreamText ? (
              <p className={styles.overviewHint} style={{ fontStyle: "italic" }}>{summaryStreamText}</p>
            ) : contentSummary ? (
              <textarea
                value={contentSummary}
                onChange={(e) => setContentSummary(e.target.value)}
                onBlur={async () => {
                  if (!activeNode) return;
                  const updated = await api.updateNode(activeNode.id, { content_summary: contentSummary });
                  setActiveNode({ ...activeNode, ...updated });
                }}
                className={styles.overviewTextarea}
                rows={3}
              />
            ) : (
              <p className={styles.overviewHint}>
                {activeNode?.content?.trim()
                  ? "Click Generate to create an AI summary of this scene's content."
                  : "Write some content first, then generate a summary."}
              </p>
            )}
          </div>
          <div className={styles.overviewField}>
            <div className={styles.linkedHeader}>
              <label className={styles.overviewLabel}>Inline Notes</label>
              {inlineNotes.length > 0 && (
                <span className={styles.overviewHint}>{inlineNotes.length} note{inlineNotes.length !== 1 ? "s" : ""}</span>
              )}
            </div>
            {inlineNotes.length === 0 ? (
              <p className={styles.overviewHint}>
                Select text and press{" "}
                {typeof navigator !== "undefined" && navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}
                +Shift+N to add a note.
              </p>
            ) : (
              <div className={styles.inlineNoteList}>
                {inlineNotes.map((note) => (
                  <div key={note.id} className={styles.inlineNoteItem}>
                    <button
                      className={styles.inlineNoteContent}
                      onClick={() => scrollToNote(note.id)}
                    >
                      <span className={styles.inlineNoteAnchor}>
                        &ldquo;{note.anchor.length > 35 ? note.anchor.slice(0, 35) + "…" : note.anchor}&rdquo;
                      </span>
                      {note.note && (
                        <span className={styles.inlineNoteText}>
                          {note.note.length > 60 ? note.note.slice(0, 60) + "…" : note.note}
                        </span>
                      )}
                    </button>
                    <button
                      className={styles.linkChipDelete}
                      onClick={() => handleDeleteNote(note.id)}
                      title="Delete note"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
          {activeStory && (
            <div className={styles.overviewField}>
              <AssetPicker
                storyId={activeStory.id}
                objectType="structure_node"
                objectId={activeNode.id}
                defaultRole="reference"
                label="Images & References"
              />
            </div>
          )}
        </div>
      )}

      {showSummary && activeStory && (
        <div className={styles.summaryWrap}>
          <StorySummaryPanel storyId={activeStory.id} />
        </div>
      )}

      <div
        className={styles.scrollArea}
        ref={scrollAreaRef}
        onClick={(e) => {
          if (editor && !(e.target as HTMLElement).closest(".ProseMirror")) {
            editor.commands.focus("end");
          }
        }}
      >
        <div className={styles.editorWrap}>
          <EditorContent editor={editor} />
        </div>
      </div>

      </div>{/* end editorColumn */}
      {chatPanelOpen && activeStory && (
        <SceneChatPanel storyId={activeStory.id} nodeId={activeNode.id} />
      )}
      </div>{/* end contentRow */}

      {/* Inline note popover */}
      {notePopover.open && (() => {
        const rect = notePopover.rect;
        const top = rect
          ? Math.min(rect.bottom + 8, window.innerHeight - 220)
          : window.innerHeight / 2 - 80;
        const left = rect
          ? Math.max(8, Math.min(rect.left, window.innerWidth - 296))
          : window.innerWidth / 2 - 140;
        const existingNote = !notePopover.isNew
          ? inlineNotes.find((n) => n.id === notePopover.noteId)
          : undefined;
        return (
          <div
            className={styles.notePopover}
            style={{ top, left }}
          >
            <div className={styles.notePopoverHeader}>
              <span className={styles.notePopoverTitle}>
                {notePopover.isNew ? "Add Note" : "Author Note"}
              </span>
              <div className={styles.notePopoverActions}>
                {!notePopover.isNew && (
                  <button
                    className={styles.notePopoverDelete}
                    onClick={() => handleDeleteNote(notePopover.noteId)}
                    title="Delete note"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                <button
                  className={styles.notePopoverClose}
                  onClick={() => setNotePopover({ open: false })}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
            <div className={styles.notePopoverBody}>
              <p className={styles.notePopoverAnchor}>
                &ldquo;{notePopover.isNew ? notePopover.anchor : existingNote?.anchor}&rdquo;
              </p>
              {notePopover.isNew ? (
                <textarea
                  className={styles.notePopoverInput}
                  value={noteInputText}
                  onChange={(e) => setNoteInputText(e.target.value)}
                  placeholder="Your note…"
                  rows={3}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setNotePopover({ open: false });
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSaveNote();
                  }}
                />
              ) : (
                <p className={styles.notePopoverNoteText}>
                  {existingNote?.note || <em>No note text.</em>}
                </p>
              )}
            </div>
            {notePopover.isNew && (
              <div className={styles.notePopoverFooter}>
                <button
                  className={styles.modalCancel}
                  onClick={() => setNotePopover({ open: false })}
                >
                  Cancel
                </button>
                <button
                  className={styles.modalSave}
                  onClick={handleSaveNote}
                  disabled={!noteInputText.trim()}
                >
                  Save Note
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Mention hover card */}
      {hoverCard.open && (() => {
        const card = hoverCard;
        const top = Math.max(8, card.rect.top - 12);
        const left = Math.max(8, Math.min(card.rect.left, window.innerWidth - 276));
        return (
          <div
            ref={hoverCardRef}
            className={styles.hoverCard}
            style={{ top, left, transform: "translateY(-100%)" }}
            onMouseEnter={() => {
              if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
            }}
            onMouseLeave={() => setHoverCard({ open: false })}
          >
            {card.found ? (
              <>
                <div className={styles.hoverCardHeader}>
                  <span className={styles.hoverCardName}>{card.name}</span>
                  <span className={styles.hoverCardLabel}>{card.roleOrLabel}</span>
                </div>
                {card.excerpt && (
                  <p className={styles.hoverCardExcerpt}>{card.excerpt}</p>
                )}
                {activeStory && (
                  <button
                    className={styles.hoverCardViewBtn}
                    onClick={() => {
                      setHoverCard({ open: false });
                      if (card.type === "character") {
                        navigate(`/stories/${activeStory.id}/characters/${card.entityId}`);
                      } else {
                        navigate(`/stories/${activeStory.id}/lorebook`);
                      }
                    }}
                  >
                    View →
                  </button>
                )}
              </>
            ) : (
              <div className={styles.hoverCardNotFound}>
                <span className={styles.hoverCardMissingName}>{card.name}</span>
                <span className={styles.hoverCardNotFoundBadge}>Not found</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* @mention autocomplete dropdown */}
      {mentionOpen && filteredMentionItems.length > 0 && (
        <div
          className={styles.mentionDropdown}
          style={{
            top: Math.min(mentionPos.bottom + 4, window.innerHeight - 260),
            left: Math.max(8, Math.min(mentionPos.left, window.innerWidth - 260)),
          }}
        >
          {filteredMentionItems.map((item, idx) => (
            <button
              key={`${item.type}:${item.name}`}
              className={`${styles.mentionItem} ${idx === mentionSelIdx ? styles.mentionItemSelected : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => doInsertMention(item)}
            >
              <span className={styles.mentionItemName}>{item.name}</span>
              {item.type === "character" && item.role ? (
                <span className={styles.mentionItemRole}>{item.role}</span>
              ) : item.type === "setting" ? (
                <span className={styles.mentionItemType}>setting</span>
              ) : null}
            </button>
          ))}
        </div>
      )}

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
