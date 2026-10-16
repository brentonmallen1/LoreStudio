import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookMarked,
  ClipboardList,
  Columns2,
  CopyPlus,
  Cpu,
  EyeOff,
  Highlighter,
  ImageIcon,
  Info,
  Layers,
  Link,
  Merge,
  MoreHorizontal,
  Palette,
  PenLine,
  Quote,
  Scissors,
  StickyNote,
  Tag,
  Trash2,
  Type,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useAIAvailable, useMode } from "../../lib/mode";
import { visibleFeatures } from "../../lib/ai/featureRegistry";
import { navigateTo } from "../../lib/navigation";
import { useStoryFormat } from "../../lib/storyFormat";
import { sceneSheetPath } from "../../lib/scene/glance";
import { useStoryStore } from "../../stores/storyStore";
import { useUIStore } from "../../stores/uiStore";
import { useProseViewStore } from "../../stores/proseViewStore";
import { useEditorBridge } from "../../stores/editorBridge";
import { useTakesStore } from "../../stores/takesStore";
import type { WritingGuideTab } from "../help/WritingGuidesModal";
import AIFeatureInfoModal from "../ai/AIFeatureInfoModal";
import FontSettings from "../story/FontSettings";
import { SprintSetup } from "../story/SprintTimer";
import type { NotesView } from "../../lib/notes/view";
import styles from "./EditorMoreMenu.module.css";

interface Props {
  wordCount: number;
  sprintRunning: boolean;
  onInsertImage: () => void;
  onOpenGuides: (tab: WritingGuideTab) => void;
  onOpenAutoTag: () => void;
  onOpenAutoLink: () => void;
  /** Notes beside the text as cards, or as dots (doc 15), and how many are open. */
  notesView: NotesView;
  noteCount: number;
  onNotesView: (view: NotesView) => void;
}

type Pane = "menu" | "type" | "sprint";

/**
 * Everything the writing desk needs now and then, behind one ⋯ (doc 14 Q1), in groups by
 * kind (doc 24): Write (an image, a sprint), This scene (its tools), Show (the notes in the
 * margin), Guides, and Settings (the type) last. The type and the sprint
 * open as panes of the same menu, so nothing else needs its own button in the top bar.
 */
export default function EditorMoreMenu(p: Props) {
  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<Pane>("menu");
  const [about, setAbout] = useState(false);
  // A script's cues say who speaks (doc 25, P4): there are no quotes to tag.
  const format = useStoryFormat();
  const script = format !== "prose";
  const { elementGuides, setElementGuides } = useUIStore();
  const { speakerColors, setSpeakerColors, hideSpeakerTags, setHideSpeakerTags } = useProseViewStore();
  const organize = useEditorBridge((s) => s.organize);
  const takes = useEditorBridge((s) => s.takes);
  const takeCount = useTakesStore((s) => s.takes.length);
  const openTake = useTakesStore((s) => s.takes.find((t) => t.is_open));
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const ai = useAIAvailable();
  const mode = useMode();
  const hasAbout = visibleFeatures("scene-editor", mode, format).length > 0;

  function close() {
    setOpen(false);
    setPane("menu");
    trigger.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) {
        setOpen(false);
        setPane("menu");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // The first item takes focus, and comes back to it from a pane.
  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLElement>("[data-pane] button, [data-pane] select")?.focus();
  }, [open, pane]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (pane === "menu") close();
      else setPane("menu");
      return;
    }
    if (pane !== "menu" || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    e.preventDefault();
    const items = [...(wrap.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? at + 1 : at - 1;
    items[(next + items.length) % items.length]?.focus();
  }

  // Runs the item and closes the menu; a pane item keeps it open on its pane.
  const then = (action: () => void) => () => {
    action();
    setOpen(false);
    setPane("menu");
    trigger.current?.focus();
  };

  return (
    <div className={styles.wrap} ref={wrap} onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        aria-label="More for this scene"
        title="Image, sprint, scene tools, what the page shows, guides, type"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <MoreHorizontal size={15} aria-hidden />
      </button>
      {open && pane === "menu" && (
        <div className={styles.menu} role="menu" aria-label="More for this scene" data-pane>
          {/* Grouped by what each does (doc 24): things to do, the scene's tools, what the
              page shows, the guides, and the one setting last. */}
          <div className={styles.label}>Write</div>
          <Item label="Insert image" icon={ImageIcon} onSelect={then(p.onInsertImage)} />
          {!p.sprintRunning && <Item label="Start a sprint…" icon={Zap} onSelect={() => setPane("sprint")} />}
          <div className={styles.label}>This scene</div>
          <Item
            label="Open the scene sheet"
            icon={ClipboardList}
            title="Every field of this scene, on one page"
            onSelect={then(() => {
              const { activeStory, activeNode } = useStoryStore.getState();
              if (activeStory && activeNode) navigateTo(sceneSheetPath(activeStory.id, activeNode.id));
            })}
          />
          {!script && (
            <Item
              label="Tag the dialogue"
              icon={Tag}
              title="Find quotes with no speaker"
              onSelect={then(p.onOpenAutoTag)}
            />
          )}
          <Item
            label="Link mentions"
            icon={Link}
            title="Find names not yet linked"
            onSelect={then(p.onOpenAutoLink)}
          />
          {takes && (
            <Item
              label="Try another version"
              icon={CopyPlus}
              title="A copy of this scene to change as you like, as a new take; the one that counts stays as it is"
              onSelect={then(takes.tryAnother)}
            />
          )}
          {takes && takeCount > 1 && (
            <Item
              label="Compare takes"
              icon={Columns2}
              title="Two takes side by side, the words that differ marked"
              onSelect={then(() => takes.compare(true))}
            />
          )}
          {takes && openTake && (
            <Item
              label="Rename this take…"
              icon={PenLine}
              title={`A few words to tell Take ${openTake.number} from the others`}
              onSelect={then(() => takes.rename(openTake.id))}
            />
          )}
          {takes && openTake && !openTake.counts && (
            <Item
              label="Delete this take"
              icon={Trash2}
              title="The take that counts stays; undo brings this one back"
              onSelect={then(() => takes.remove(openTake.id))}
            />
          )}
          {organize && (
            <Item
              label="Split the scene here…"
              icon={Scissors}
              title="The words after the cursor become the next scene"
              onSelect={then(organize.split)}
            />
          )}
          {organize && (
            <Item
              label="Join with the next scene"
              icon={Merge}
              title="The next scene's words follow this one's, after a scene break"
              onSelect={then(organize.merge)}
            />
          )}
          <div className={styles.label}>Show</div>
          <Item
            label="Notes in the margin"
            icon={StickyNote}
            checked={p.notesView === "cards"}
            hint={`${p.notesView === "cards" ? "On" : "Dots"}${p.noteCount > 0 ? ` · ${p.noteCount}` : ""}`}
            title={
              p.notesView === "cards"
                ? "Notes sit beside the text; choose to show them as dots"
                : "Notes show as dots; choose to show them beside the text"
            }
            // A setting under Show changes the page in place, and the menu stays open to see it.
            onSelect={() => p.onNotesView(p.notesView === "cards" ? "dots" : "cards")}
          />
          {!script && (
            <Item
              label="Color dialogue by speaker"
              icon={Highlighter}
              checked={speakerColors}
              hint={speakerColors ? "On" : "Off"}
              title="Each line on a soft tint of its speaker's color, with a line under it"
              onSelect={() => setSpeakerColors(!speakerColors)}
            />
          )}
          {!script && (
            <Item
              label="Hide speaker tags"
              icon={EyeOff}
              checked={hideSpeakerTags}
              hint={hideSpeakerTags ? "On" : "Off"}
              title="The <Name> after a line shows only while the cursor is in that line; point at the line to see who says it"
              onSelect={() => setHideSpeakerTags(!hideSpeakerTags)}
            />
          )}
          {script && (
            <Item
              label="Element guides"
              icon={Palette}
              checked={elementGuides}
              hint={elementGuides ? "On" : "Off"}
              title="Each element's words in a color of their own, its name beside the line you are writing, and a hint on an empty line"
              onSelect={() => setElementGuides(!elementGuides)}
            />
          )}
          <div className={styles.label}>Guides</div>
          <Item
            label="Dialogue"
            icon={Quote}
            title="How to attribute dialogue"
            onSelect={then(() => p.onOpenGuides("dialogue"))}
          />
          <Item
            label="MICE quotient"
            icon={Layers}
            title="Milieu, Idea, Character, Event"
            onSelect={then(() => p.onOpenGuides("mice"))}
          />
          <Item
            label="Six essential questions"
            icon={BookMarked}
            onSelect={then(() => p.onOpenGuides("essential"))}
          />
          {hasAbout && (
            <Item
              label={ai ? "About the AI and analysis tools" : "About the analysis tools"}
              icon={ai ? Cpu : Info}
              onSelect={then(() => setAbout(true))}
            />
          )}
          <div className={styles.label}>Settings</div>
          <Item label="Type and width…" icon={Type} onSelect={() => setPane("type")} />
        </div>
      )}
      {open && pane !== "menu" && (
        <div
          className={styles.menu}
          role="dialog"
          aria-label={pane === "type" ? "Type and width" : "Start a sprint"}
          data-pane
        >
          <button type="button" className={styles.back} onClick={() => setPane("menu")}>
            <ArrowLeft size={12} aria-hidden /> {pane === "type" ? "Type and width" : "Start a sprint"}
          </button>
          {pane === "type" ? (
            <FontSettings />
          ) : (
            <SprintSetup currentWordCount={p.wordCount} onStarted={close} />
          )}
        </div>
      )}
      <AIFeatureInfoModal isOpen={about} onClose={() => setAbout(false)} pageId="scene-editor" />
    </div>
  );
}

function Item({
  label,
  icon: Icon,
  onSelect,
  hint,
  title,
  checked,
}: {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  hint?: string;
  title?: string;
  /** A setting that is on or off: said as such, and its state in accent. */
  checked?: boolean;
}) {
  const toggle = checked !== undefined;
  return (
    <button
      type="button"
      role={toggle ? "menuitemcheckbox" : "menuitem"}
      aria-checked={toggle ? checked : undefined}
      className={styles.item}
      onClick={onSelect}
      title={title}
    >
      <Icon size={13} aria-hidden />
      <span className={styles.itemLabel}>{label}</span>
      {hint &&
        (toggle ? (
          <span className={`${styles.state} ${checked ? styles.stateOn : ""}`}>{hint}</span>
        ) : (
          <kbd className={styles.hint}>{hint}</kbd>
        ))}
    </button>
  );
}
