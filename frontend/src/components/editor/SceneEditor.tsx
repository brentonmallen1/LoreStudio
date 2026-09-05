import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Typography from "@tiptap/extension-typography";
import { X } from "lucide-react";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import { useAIStore } from "../../stores/aiStore";
import { InlineNoteExtension } from "../story/InlineNoteExtension";
import {
  InlineImageExtension,
  setInlineImageInsertCallback,
  insertInlineImage,
} from "../story/InlineImageExtension";
import { MentionDropdownExtension } from "../story/MentionDropdown";
import { DialogueExtension } from "../story/DialogueExtension";
import { SlashCommandExtension } from "../story/SlashCommandExtension";
import { TodoExtension } from "../story/TodoExtension";
import { SearchAndReplaceExtension } from "../story/SearchAndReplaceExtension";
import ImageInsertModal from "../story/ImageInsertModal";
import WritingGuidesModal, { type WritingGuideTab } from "../help/WritingGuidesModal";
import AutoTagDialoguePanel from "../story/AutoTagDialoguePanel";
import AutoLinkEntitiesPanel from "../story/AutoLinkEntitiesPanel";
import StorySummaryPanel from "../story/StorySummaryPanel";
import BrainstormPanel from "../layout/BrainstormPanel";
import ScenePlannerPanel from "../layout/ScenePlannerPanel";
import SelectionToolbar from "../story/SelectionToolbar";
import EditorSearchBar from "../story/EditorSearchBar";
import { useSceneAutosave } from "./useSceneAutosave";
import { useMentionDropdown } from "./useMentionDropdown";
import { useSlashCommands } from "./useSlashCommands";
import { useInlineNotes } from "./useInlineNotes";
import { useMentionHoverCard } from "./useMentionHoverCard";
import MentionDropdown from "./MentionDropdown";
import { SlashPicker, TodoInputPopup } from "./SlashPicker";
import InlineNotePopover from "./InlineNotePopover";
import MentionHoverCard from "./MentionHoverCard";
import EditorTopbar from "./EditorTopbar";
import { DraftBanner } from "./SaveStatusPill";
import DialogueIsolationView from "./DialogueIsolationView";
import SceneOverviewPanel from "./panels/SceneOverviewPanel";
import styles from "./SceneEditor.module.css";

const SELECTION_DEBOUNCE_MS = 400;

/**
 * The manuscript editor shell. Owns the TipTap instance and composes the
 * editor hooks (autosave, mentions, slash commands, inline notes, hover card)
 * with the topbar, side panel and popups. Each of those lives in its own file.
 */
export default function SceneEditor() {
  const { activeNode, setActiveNode, activeStory, characters, setCharacters } = useStoryStore();
  const {
    brainstormPanelOpen,
    plannerPanelOpen,
    sceneSearchOpen,
    openSceneSearch,
    closeSceneSearch,
    dialogueInsertTrigger,
    writingGuidesTab,
    openWritingGuides,
    closeWritingGuides,
  } = useUIStore();
  const { sessions, createSession, setActiveSession } = useAIStore();

  const [showSummary, setShowSummary] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [guidesTab, setGuidesTab] = useState<WritingGuideTab>("dialogue");
  const [showAutoTag, setShowAutoTag] = useState(false);
  const [showAutoLink, setShowAutoLink] = useState(false);
  const [dialogueIsolation, setDialogueIsolation] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const selectionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const notePopoverRef = useRef<HTMLDivElement>(null);
  const hoverCardRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Begin writing…" }),
      CharacterCount,
      Typography,
      InlineNoteExtension,
      InlineImageExtension,
      MentionDropdownExtension,
      SlashCommandExtension,
      DialogueExtension,
      TodoExtension,
      SearchAndReplaceExtension,
    ],
    content: activeNode?.content ?? "",
    onSelectionUpdate: ({ editor }) => {
      if (selectionDebounceRef.current) clearTimeout(selectionDebounceRef.current);
      if (editor.state.selection.empty) {
        setSelectionRect(null);
        return;
      }
      selectionDebounceRef.current = setTimeout(() => {
        const sel = window.getSelection();
        const rect = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).getBoundingClientRect() : null;
        setSelectionRect(rect && rect.width > 0 ? rect : null);
      }, SELECTION_DEBOUNCE_MS);
    },
    onUpdate: ({ editor }) => autosaveRef.current?.handleUpdate(editor),
  });
  const autosave = useSceneAutosave(editor);
  const autosaveRef = useRef(autosave);
  useEffect(() => {
    autosaveRef.current = autosave;
  });

  const mention = useMentionDropdown({ editor, activeStory, characters, setCharacters });
  const { slash, todoInput } = useSlashCommands({
    editor,
    activeNode,
    activeStory,
    openDialoguePicker: mention.openDialoguePicker,
  });
  const notes = useInlineNotes({ editor, activeNode, setActiveNode, popoverRef: notePopoverRef });
  const hover = useMentionHoverCard(
    scrollAreaRef,
    hoverCardRef,
    characters,
    mention.flatLocations,
    activeNode?.id,
  );

  // Load the active node's content into the editor when the selection changes
  useEffect(() => {
    if (!editor || !activeNode) return;
    if (editor.getHTML() !== activeNode.content) editor.commands.setContent(activeNode.content ?? "");
  }, [activeNode?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setInlineImageInsertCallback(() => setImagePickerOpen(true));
  }, []);

  // Command palette → dialogue insert trigger (same as pressing ^)
  const prevTrigger = useRef(dialogueInsertTrigger);
  useEffect(() => {
    if (dialogueInsertTrigger === prevTrigger.current) return;
    prevTrigger.current = dialogueInsertTrigger;
    if (!editor) return;
    editor.commands.focus();
    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    mention.openDialoguePicker(coords.bottom, coords.left);
  }, [dialogueInsertTrigger, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Command palette → writing guides modal: the store's tab wins while it is set
  const effectiveGuidesTab = writingGuidesTab ?? guidesTab;

  /** Open (or focus) an AI session seeded with the current selection. */
  function openSelectionSession(type: string, reuseEmpty = false) {
    if (!editor || !activeStory || !activeNode) return;
    const { from, to, empty } = editor.state.selection;
    const selectedText = empty ? undefined : editor.state.doc.textBetween(from, to).trim() || undefined;
    const existing = reuseEmpty
      ? sessions.find((s) => s.type === type && s.context.nodeId === activeNode.id && s.messages.length === 0)
      : undefined;
    if (existing) setActiveSession(existing.id);
    else createSession(type, { storyId: activeStory.id, nodeId: activeNode.id, selectedText });
    setSelectionRect(null);
  }

  // ⌘F find · ⌘⇧R writing coach · ⌘⇧D attribute dialogue
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && e.key === "f") {
        e.preventDefault();
        openSceneSearch();
      }
      if (mod && e.shiftKey && e.key === "R") {
        e.preventDefault();
        openSelectionSession("writing-coach", true);
      }
      if (mod && e.shiftKey && e.key === "D") {
        e.preventDefault();
        mention.triggerAttributeDialogue();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [editor, activeNode?.id, activeStory?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeNode) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>Select a section from the sidebar to begin writing.</p>
      </div>
    );
  }

  function applyUpdated(updated: Partial<typeof activeNode> & { content?: string }) {
    if (!activeNode) return;
    setActiveNode({ ...activeNode, ...updated });
    if (editor && updated.content) editor.commands.setContent(updated.content, false);
  }

  return (
    <div className={styles.container}>
      <EditorTopbar
        activeNode={activeNode}
        wordCount={autosave.wordCount}
        autosave={autosave}
        showOverview={showOverview}
        onToggleOverview={() => setShowOverview((s) => !s)}
        dialogueIsolation={dialogueIsolation}
        onToggleDialogue={() => setDialogueIsolation((v) => !v)}
        onToggleSummary={() => setShowSummary((s) => !s)}
        onOpenImagePicker={() => setImagePickerOpen(true)}
        onOpenAutoTag={() => setShowAutoTag(true)}
        onOpenAutoLink={() => setShowAutoLink(true)}
        onOpenGuides={(tab) => {
          setGuidesTab(tab);
          openWritingGuides(tab);
        }}
      />

      <div className={styles.contentRow}>
        <div className={styles.editorColumn}>
          {showOverview && (
            <SceneOverviewPanel
              key={activeNode.id}
              activeNode={activeNode}
              activeStory={activeStory}
              characters={characters}
              locations={mention.flatLocations}
              notes={notes}
            />
          )}

          {showSummary && activeStory && (
            <div className={styles.summaryWrap}>
              <button className={styles.summaryCloseBtn} onClick={() => setShowSummary(false)} title="Close">
                <X size={13} />
              </button>
              <StorySummaryPanel storyId={activeStory.id} />
            </div>
          )}

          {sceneSearchOpen && editor && <EditorSearchBar editor={editor} onClose={closeSceneSearch} />}
          <DraftBanner autosave={autosave} />

          <div
            className={styles.scrollArea}
            ref={scrollAreaRef}
            onClick={(e) => {
              if (!dialogueIsolation && editor && !(e.target as HTMLElement).closest(".ProseMirror")) {
                editor.commands.focus("end");
              }
            }}
          >
            {dialogueIsolation ? (
              <DialogueIsolationView
                activeNode={activeNode}
                activeStory={activeStory}
                characters={characters}
                editor={editor}
                setActiveNode={setActiveNode}
                onExit={() => setDialogueIsolation(false)}
                onOpenAutoTag={() => setShowAutoTag(true)}
              />
            ) : (
              <div
                className={`${styles.editorWrap}${notes.hideEditorial ? ` ${styles.hideEditorialNotes}` : ""}`}
              >
                <EditorContent editor={editor} />
              </div>
            )}
          </div>
        </div>
        {plannerPanelOpen && activeStory && (
          <ScenePlannerPanel storyId={activeStory.id} nodeId={activeNode.id} />
        )}
        {brainstormPanelOpen && activeStory && (
          <BrainstormPanel storyId={activeStory.id} nodeId={activeNode.id} />
        )}
      </div>

      <WritingGuidesModal
        isOpen={!!writingGuidesTab}
        onClose={closeWritingGuides}
        initialTab={effectiveGuidesTab}
      />

      {showAutoTag && (
        <AutoTagDialoguePanel
          sceneId={activeNode.id}
          storyId={activeStory?.id}
          characterNames={characters.map((c) => c.name)}
          onClose={() => setShowAutoTag(false)}
          onApplied={applyUpdated}
        />
      )}
      {showAutoLink && (
        <AutoLinkEntitiesPanel
          nodeId={activeNode.id}
          onClose={() => setShowAutoLink(false)}
          onApplied={applyUpdated}
        />
      )}

      <SelectionToolbar
        selectionRect={selectionRect}
        onOpenCoach={() => openSelectionSession("writing-coach", true)}
        onAddNote={notes.triggerAdd}
        onAttributeDialogue={mention.triggerAttributeDialogue}
        onAnalyzeShowTell={() => openSelectionSession("show-dont-tell")}
        onAnalyzeAudience={() => openSelectionSession("audience-adherence")}
        onClicheCoach={() => openSelectionSession("cliche-coach")}
      />

      <InlineNotePopover notes={notes} popoverRef={notePopoverRef} />
      <MentionHoverCard hover={hover} cardRef={hoverCardRef} storyId={activeStory?.id} />
      <SlashPicker slash={slash} />
      <TodoInputPopup todo={todoInput} />
      <MentionDropdown mention={mention} />

      {imagePickerOpen && activeStory && (
        <ImageInsertModal
          storyId={activeStory.id}
          onInsert={(assetId, alt) => {
            insertInlineImage(editor, assetId, alt);
            setImagePickerOpen(false);
          }}
          onClose={() => setImagePickerOpen(false)}
        />
      )}
    </div>
  );
}
