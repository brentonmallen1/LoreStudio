import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookMarked,
  Cpu,
  ImageIcon,
  Info,
  Layers,
  Link,
  MessageSquareQuote,
  MoreHorizontal,
  Quote,
  StickyNote,
  Tag,
  Type,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useAIAvailable, useMode } from "../../lib/mode";
import { visibleFeatures } from "../../lib/ai/featureRegistry";
import { SHORTCUTS, formatCombo } from "../../lib/keyboard/shortcuts";
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
  /** Only the scene's dialogue, in place of the prose (P7 moves it into the panel). */
  dialogueIsolation: boolean;
  onToggleDialogue: () => void;
}

type Pane = "menu" | "type" | "sprint";

/**
 * Everything the writing desk needs now and then, behind one ⋯ (doc 14 Q1), in groups by
 * kind (doc 24): Write (an image, a sprint), This scene (its tools), Show (the notes in the
 * margin, the dialogue only), Guides, and Settings (the type) last. The type and the sprint
 * open as panes of the same menu, so nothing else needs its own button in the top bar.
 */
export default function EditorMoreMenu(p: Props) {
  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<Pane>("menu");
  const [about, setAbout] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const ai = useAIAvailable();
  const mode = useMode();
  const hasAbout = visibleFeatures("scene-editor", mode).length > 0;

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
          <Item
            label="Insert image"
            icon={ImageIcon}
            hint={formatCombo(SHORTCUTS.insertImage.combo)}
            onSelect={then(p.onInsertImage)}
          />
          {!p.sprintRunning && <Item label="Start a sprint…" icon={Zap} onSelect={() => setPane("sprint")} />}
          <div className={styles.label}>This scene</div>
          <Item
            label="Tag the dialogue"
            icon={Tag}
            title="Find quotes with no speaker"
            onSelect={then(p.onOpenAutoTag)}
          />
          <Item
            label="Link mentions"
            icon={Link}
            title="Find names not yet linked"
            onSelect={then(p.onOpenAutoLink)}
          />
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
            onSelect={then(() => p.onNotesView(p.notesView === "cards" ? "dots" : "cards"))}
          />
          <Item
            label="Dialogue only"
            icon={MessageSquareQuote}
            checked={p.dialogueIsolation}
            hint={p.dialogueIsolation ? "On" : undefined}
            title="Only the scene's dialogue, line by line"
            onSelect={then(p.onToggleDialogue)}
          />
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
