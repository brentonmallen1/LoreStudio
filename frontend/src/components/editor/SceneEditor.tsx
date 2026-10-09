import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Typography from "@tiptap/extension-typography";
import { X } from "lucide-react";
import { api } from "../../api/client";
import { noteWritingActivity } from "../../lib/writingToday";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import { useAIStore } from "../../stores/aiStore";
import { usePanelStore } from "../../stores/panelStore";
import { useEditorBridge } from "../../stores/editorBridge";
import { InlineNoteExtension } from "../story/InlineNoteExtension";
import {
  InlineImageExtension,
  setInlineImageInsertCallback,
  insertInlineImage,
} from "../story/InlineImageExtension";
import {
  MentionDropdownExtension,
  FORCE_MENTION_KEY,
  mentionLexicon,
  setMentionHighlight,
} from "../story/MentionDropdown";
import { DialogueExtension } from "../story/DialogueExtension";
import { SlashCommandExtension } from "../story/SlashCommandExtension";
import { SearchAndReplaceExtension } from "../story/SearchAndReplaceExtension";
import { PassageFlashExtension } from "../story/PassageFlashExtension";
import ImageInsertModal from "../story/ImageInsertModal";
import WritingGuidesModal, { type WritingGuideTab } from "../help/WritingGuidesModal";
import AutoTagDialoguePanel from "../story/AutoTagDialoguePanel";
import AutoLinkEntitiesPanel from "../story/AutoLinkEntitiesPanel";
import StorySummaryPanel from "../story/StorySummaryPanel";
import BrainstormPanel from "../layout/BrainstormPanel";
import ScenePlannerPanel from "../layout/ScenePlannerPanel";
import SelectionToolbar from "../story/SelectionToolbar";
import PromisePicker from "../promises/PromisePicker";
import EditorSearchBar from "../story/EditorSearchBar";
import { useSceneAutosave } from "./useSceneAutosave";
import { useMentionDropdown } from "./useMentionDropdown";
import { useSlashCommands } from "./useSlashCommands";
import { useInlineNotes } from "./useInlineNotes";
import { useMentionHoverCard } from "./useMentionHoverCard";
import { useSceneDialogue } from "./useSceneDialogue";
import { usePassageJump } from "./usePassageJump";
import { UnifiedUndoExtension } from "./UnifiedUndoExtension";
import { loadScene, patchScene, setLiveScene } from "../../lib/undo/sceneHistory";
import MentionDropdown from "./MentionDropdown";
import { SlashPicker } from "./SlashPicker";
import NoteMargin from "./NoteMargin";
import { readNotesView, saveNotesView } from "../../lib/notes/view";
import MentionHoverCard from "./MentionHoverCard";
import { removeSpeakerTags, retagSpeakers, unlinkMentions } from "../../lib/mentions/unlink";
import MentionGutter from "./MentionGutter";
import EditorTopbar from "./EditorTopbar";
import DraftBanner from "./DraftBanner";
import StatusCorner from "./StatusCorner";
import { useAIAvailable } from "../../lib/mode";
import { SHORTCUTS, matchesCombo } from "../../lib/keyboard/shortcuts";
import DialogueIsolationView from "./DialogueIsolationView";
import EmptyManuscript from "./EmptyManuscript";
import ScenePlanCard from "./ScenePlanCard";
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
    storySummaryOpen,
    closeStorySummary,
  } = useUIStore();
  const { sessions, createSession, setActiveSession } = useAIStore();
  const aiAvailable = useAIAvailable();
  // Notes sit in the prose's left margin (doc 13 P2); the topbar button shows or hides it.
  const [notesView, setNotesView] = useState(readNotesView);
  const activateTab = usePanelStore((s) => s.activate);
  const openEntity = usePanelStore((s) => s.openEntity);
  const setBridgeNotes = useEditorBridge((s) => s.setNotes);
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
      SearchAndReplaceExtension,
      PassageFlashExtension,
      UnifiedUndoExtension,
    ],
    content: activeNode?.content ?? "",
    editorProps: { attributes: { "aria-label": "Scene text" } },
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
    onUpdate: ({ editor }) => {
      noteWritingActivity();
      autosaveRef.current?.handleUpdate(editor);
    },
  });
  const autosave = useSceneAutosave(editor);
  const autosaveRef = useRef(autosave);
  useEffect(() => {
    autosaveRef.current = autosave;
  });

  const mention = useMentionDropdown({ editor, activeStory, characters, setCharacters });
  const notes = useInlineNotes({ editor, activeNode, setActiveNode, popoverRef: notePopoverRef });
  const { slash } = useSlashCommands({
    editor,
    openDialoguePicker: mention.openDialoguePicker,
    addTodo: () => notes.triggerAdd("todo"),
  });
  useSceneDialogue(editor, activeNode?.id, activeNode?.updated_at);
  const hover = useMentionHoverCard(
    scrollAreaRef,
    hoverCardRef,
    characters,
    mention.flatLocations,
    activeNode?.id,
    (m) => openEntity(m.type === "character" ? "character" : "location", m.entityId, m.name),
  );

  // The entity whose tab is open or hovered lights up in the prose (doc 11 P2). The
  // decoration plugin paints it, so ProseMirror's own DOM is never touched from outside.
  const highlightName = usePanelStore((s) => s.highlight?.name ?? null);
  useEffect(() => {
    setMentionHighlight(highlightName);
    if (editor?.view) editor.view.dispatch(editor.state.tr.setMeta(FORCE_MENTION_KEY, true));
  }, [highlightName, editor]);

  // The side panel's inline-notes field reads the editor's live notes through the bridge.
  useEffect(() => {
    setBridgeNotes(notes);
  });
  useEffect(() => () => setBridgeNotes(null), [setBridgeNotes]);

  // Load the active node's content into the editor when the selection changes.
  // A node from the tree listing carries no prose (StructureNodeMeta), and resuming or
  // "Continue writing" can hand one over: fetch the full node rather than show — and
  // risk saving — an empty scene.
  const needsProse = !!activeNode && activeNode.content === undefined;
  useEffect(() => {
    if (!editor || !activeNode) return;
    if (needsProse) {
      const id = activeNode.id;
      api.getNode(id).then((full) => {
        if (useStoryStore.getState().activeNode?.id === id) setActiveNode(full);
      });
      return;
    }
    loadScene(editor, activeNode.content ?? "");
  }, [activeNode?.id, needsProse, editor]); // eslint-disable-line react-hooks/exhaustive-deps
  // This editor's typing is a history ⌘Z reaches from anywhere in the story (doc 23 P5b).
  useEffect(() => {
    if (!editor || !activeNode) return;
    const flush = () => autosaveRef.current?.flush() ?? Promise.resolve();
    setLiveScene({ editor, nodeId: activeNode.id, title: activeNode.title, flush });
  }, [editor, activeNode?.id, activeNode?.title]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => setLiveScene(null), [editor]);
  // A finding's words, shown once the prose above is in.
  usePassageJump(editor, activeNode?.id, !!activeNode && !needsProse);

  // An empty scene is somewhere to type: put the cursor there. A new story used to open
  // its first scene with the cursor nowhere, so the first words went missing. A scene
  // with text keeps focus where it was, so arrowing through the tree still works.
  useEffect(() => {
    if (!editor || !activeNode || !editor.isEmpty) return;
    const frame = requestAnimationFrame(() => editor.commands.focus("end"));
    return () => cancelAnimationFrame(frame);
  }, [editor, activeNode?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setInlineImageInsertCallback(() => setImagePickerOpen(true));
  }, []);

  // Command palette → dialogue insert trigger (same as pressing ^)
  const prevTrigger = useRef(dialogueInsertTrigger);
  useEffect(() => {
    if (dialogueInsertTrigger === prevTrigger.current) return;
    prevTrigger.current = dialogueInsertTrigger;
    if (!editor) return;
    mention.openDialoguePicker();
  }, [dialogueInsertTrigger, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Command palette → writing guides modal: the store's tab wins while it is set
  const effectiveGuidesTab = writingGuidesTab ?? guidesTab;

  // "Plant a clue for…" / "Reveal a twist here…" on the selected words (doc 18 C6)
  const [promisePick, setPromisePick] = useState<{
    kind: "clue" | "reveal";
    quote: string;
    rect: DOMRect;
  } | null>(null);
  function pickPromise(kind: "clue" | "reveal") {
    if (!editor || !selectionRect) return;
    const { from, to } = editor.state.selection;
    setPromisePick({ kind, quote: editor.state.doc.textBetween(from, to, " ").trim(), rect: selectionRect });
    setSelectionRect(null);
  }

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
      if (matchesCombo(e, SHORTCUTS.find.combo)) {
        e.preventDefault();
        openSceneSearch();
      }
      if (aiAvailable && matchesCombo(e, SHORTCUTS.writingCoach.combo)) {
        e.preventDefault();
        openSelectionSession("writing-coach", true);
      }
      if (matchesCombo(e, SHORTCUTS.attributeDialogue.combo)) {
        e.preventDefault();
        mention.triggerAttributeDialogue();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [editor, activeNode?.id, activeStory?.id, aiAvailable]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeNode) return <EmptyManuscript />;

  function applyUpdated(updated: Partial<typeof activeNode> & { content?: string }) {
    if (!activeNode) return;
    setActiveNode({ ...activeNode, ...updated });
    if (editor && updated.content) patchScene(editor, updated.content);
  }

  return (
    <div className={styles.container}>
      <EditorTopbar
        activeNode={activeNode}
        wordCount={autosave.wordCount}
        notesView={notesView}
        noteCount={notes.sceneNotes.filter((n) => !n.done).length}
        onNotesView={(v) => setNotesView(saveNotesView(v))}
        dialogueIsolation={dialogueIsolation}
        onToggleDialogue={() => setDialogueIsolation((v) => !v)}
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
          {storySummaryOpen && activeStory && aiAvailable && (
            <div className={styles.summaryWrap}>
              <button
                className={styles.summaryCloseBtn}
                onClick={closeStorySummary}
                title="Close"
                aria-label="Close"
              >
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
                {editor?.isEmpty && (
                  <ScenePlanCard
                    node={activeNode}
                    story={activeStory}
                    characters={characters}
                    onOpenNotes={() => activateTab("scene")}
                  />
                )}
                <EditorContent editor={editor} />
              </div>
            )}
            {!dialogueIsolation && (
              <NoteMargin
                notes={notes}
                scrollAreaRef={scrollAreaRef}
                marginRef={notePopoverRef}
                view={notesView}
              />
            )}
            <MentionGutter scrollAreaRef={scrollAreaRef} />
          </div>
        </div>
        {plannerPanelOpen && activeStory && (
          <ScenePlannerPanel storyId={activeStory.id} nodeId={activeNode.id} />
        )}
        {aiAvailable && brainstormPanelOpen && activeStory && (
          <BrainstormPanel storyId={activeStory.id} nodeId={activeNode.id} />
        )}
      </div>

      <StatusCorner node={activeNode} autosave={autosave} wordCount={autosave.wordCount} />

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
        onAddNote={(kind) => notes.triggerAdd(kind)}
        onAttributeDialogue={mention.triggerAttributeDialogue}
        onPlantClue={() => pickPromise("clue")}
        onRevealTwist={() => pickPromise("reveal")}
        onAnalyzeShowTell={() => openSelectionSession("show-dont-tell")}
        onAnalyzeAudience={() => openSelectionSession("audience-adherence")}
        onClicheCoach={() => openSelectionSession("cliche-coach")}
        showAI={aiAvailable}
      />

      {promisePick && activeStory && activeNode && (
        <PromisePicker
          {...promisePick}
          storyId={activeStory.id}
          nodeId={activeNode.id}
          onClose={() => setPromisePick(null)}
        />
      )}

      <MentionHoverCard
        hover={hover}
        cardRef={hoverCardRef}
        storyId={activeStory?.id}
        onUnlink={(type, name, speakerTag) => {
          if (!editor) return;
          const done = speakerTag
            ? removeSpeakerTags(editor, name, mentionLexicon())
            : unlinkMentions(editor, type, name, mentionLexicon());
          // Back in the prose, so ⌘Z puts the link back straight away.
          if (done) editor.commands.focus();
        }}
        onRetag={(written, name) => {
          if (editor && retagSpeakers(editor, written, name, mentionLexicon())) editor.commands.focus();
        }}
      />
      <SlashPicker slash={slash} />
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
