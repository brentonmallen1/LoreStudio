import { useCallback, useEffect, useState, type RefObject } from "react";
import { layoutCards, type MarginAnchor } from "../../lib/notes/marginLayout";
import { NewNoteCard, NoteCard, NotePeek } from "./NoteCard";
import { KIND_LABEL } from "../notes/kinds";
import { marginMode, type NotesView } from "../../lib/notes/view";
import type { InlineNotesState } from "./useInlineNotes";
import styles from "./NoteMargin.module.css";

/** Narrower than this beside the prose, and the margin shows markers instead of cards. */
const MIN_MARGIN = 180;
const MAX_CARD = 260;
const GAP = 8;

type Geometry = {
  mode: "cards" | "markers" | "none";
  proseLeft: number;
  proseWidth: number;
  cardLeft: number;
  cardWidth: number;
  anchors: (MarginAnchor & { height: number })[];
  /** Where a note being added starts: the top and height of the selected words. */
  pending: { top: number; height: number } | null;
};

const EMPTY: Geometry = {
  mode: "none",
  proseLeft: 0,
  proseWidth: 0,
  cardLeft: 0,
  cardWidth: 0,
  anchors: [],
  pending: null,
};

/**
 * The scene's notes as comments in the prose's left margin (doc 13 P2, D6), each level with
 * the words it is about. Where the margin is too narrow, or the author chose dots, a note
 * opens over the prose just under its words instead. Everything here is measured from the
 * editor's DOM and drawn beside it; ProseMirror's own DOM is never touched.
 */
export default function NoteMargin({
  notes,
  scrollAreaRef,
  marginRef,
  view,
}: {
  notes: InlineNotesState;
  scrollAreaRef: RefObject<HTMLDivElement | null>;
  /** Clicks inside this keep a note open (useInlineNotes closes it on any other click). */
  marginRef: RefObject<HTMLDivElement | null>;
  /** Cards or dots (lib/notes/view). */
  view: NotesView;
}) {
  const { popover } = notes;
  const shown = notes.notes.filter((n) => !(notes.hideEditorial && n.type === "editorial"));
  const activeId = popover.open && !popover.isNew ? popover.noteId : null;
  const [geo, setGeo] = useState<Geometry>(EMPTY);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [hoverId, setHoverId] = useState<string | null>(null);
  // Each card's height, as it is drawn, so the cards below can make room for it.
  const [sizer] = useState(
    () =>
      new ResizeObserver((entries) =>
        setHeights((prev) => {
          const next = { ...prev };
          for (const e of entries) {
            const id = (e.target as HTMLElement).dataset.cardId;
            if (id) next[id] = (e.target as HTMLElement).offsetHeight;
          }
          return next;
        }),
      ),
  );
  useEffect(() => () => sizer.disconnect(), [sizer]);
  const cardRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) sizer.observe(el);
    },
    [sizer],
  );
  const noteKey = shown.map((n) => n.id).join(",");

  // Where the anchors are, and how much room the margin has.
  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area) return;
    let frame = 0;
    let observed: HTMLElement | null = null;
    const ids = noteKey ? noteKey.split(",") : [];
    function measure() {
      // The editor may mount after this does; look for the prose every time.
      const prose = area?.querySelector<HTMLElement>(".ProseMirror");
      if (!area || !prose) return;
      if (observed !== prose) {
        observed = prose;
        ro.observe(prose);
      }
      const areaRect = area.getBoundingClientRect();
      const proseRect = prose.getBoundingClientRect();
      const proseLeft = proseRect.left - areaRect.left;
      const room = proseLeft - 24;
      const anchors = ids.flatMap((id) => {
        const el = prose.querySelector<HTMLElement>(`[data-note-id="${CSS.escape(id)}"]`);
        if (!el) return [];
        const r = el.getBoundingClientRect();
        return [{ id, top: r.top - areaRect.top + area.scrollTop, height: r.height }];
      });
      const cardWidth = Math.min(MAX_CARD, room - 16);
      const rect = popover.open && popover.isNew ? popover.rect : null;
      const next: Geometry = {
        pending: rect ? { top: rect.top - areaRect.top + area.scrollTop, height: rect.height } : null,
        mode: marginMode(view, room, MIN_MARGIN),
        proseLeft,
        proseWidth: proseRect.width,
        cardLeft: proseLeft - 24 - cardWidth,
        cardWidth,
        anchors,
      };
      setGeo((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    const ro = new ResizeObserver(schedule);
    ro.observe(area);
    // Changes to the prose move the anchors; changes to the margin itself are ours.
    const mo = new MutationObserver((records) => {
      if (records.some((r) => !marginRef.current?.contains(r.target))) schedule();
    });
    mo.observe(area, { childList: true, subtree: true, characterData: true });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      ro.disconnect();
    };
  }, [scrollAreaRef, marginRef, noteKey, view, popover]);

  // Hovering the words lights the card; the card lights the words through a style rule,
  // so no class is ever set on ProseMirror's own spans.
  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area) return;
    function over(e: MouseEvent) {
      if (marginRef.current?.contains(e.target as Node)) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>(".note-anchor[data-note-id]");
      setHoverId(el?.dataset.noteId ?? null);
    }
    area.addEventListener("mouseover", over);
    return () => area.removeEventListener("mouseover", over);
  }, [scrollAreaRef, marginRef]);

  // Escape closes a note that is only being read.
  useEffect(() => {
    if (!popover.open || popover.isNew || popover.isEditing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        notes.setPopover({ open: false });
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [popover, notes]);

  const newTop = popover.open && popover.isNew ? (geo.pending?.top ?? null) : null;
  const anchorOf = (id: string) => geo.anchors.find((a) => a.id === id);
  const byId = new Map(shown.map((n) => [n.id, n]));
  const lit = hoverId ?? activeId;
  // Each passage takes its note's colour (doc 15): a question's words in its blue, a ticked
  // to-do's faded. The marks themselves only carry the id, so the kinds live in these rules.
  // Only a passage whose note exists is marked: a note deleted from the Notes page leaves its
  // span in the prose until the scene is next edited, and that span shows nothing.
  const kindRules = shown
    .map(
      (n) =>
        `.ProseMirror [data-note-id="${CSS.escape(n.id)}"] { --note-mark: var(--note-kind-${n.kind}); ${
          n.done ? "opacity: 0.6;" : ""
        } }`,
    )
    .join("\n");
  const litRule =
    kindRules +
    (lit
      ? `\n.ProseMirror [data-note-id="${CSS.escape(lit)}"] { background: color-mix(in srgb, var(--note-mark, var(--color-note-marker)) 32%, transparent); }`
      : "");

  if (geo.mode === "cards") {
    const placed = geo.anchors.map((a) => ({ id: a.id, top: a.top }));
    if (newTop !== null) placed.push({ id: "new", top: newTop });
    const tops = layoutCards(placed, heights, GAP, popover.open ? (activeId ?? "new") : null);
    return (
      <div ref={marginRef} className={styles.margin} aria-label="Notes">
        <style>{litRule}</style>
        {geo.anchors.map((a) => {
          const note = byId.get(a.id);
          if (!note) return null;
          return (
            <NoteCard
              key={a.id}
              note={note}
              notes={notes}
              active={a.id === activeId}
              lit={a.id === hoverId}
              style={{ top: tops[a.id], left: geo.cardLeft, width: geo.cardWidth }}
              cardRef={cardRef}
              onHover={setHoverId}
            />
          );
        })}
        {newTop !== null && (
          <NewNoteCard
            notes={notes}
            style={{ top: tops.new, left: geo.cardLeft, width: geo.cardWidth }}
            cardRef={cardRef}
          />
        )}
      </div>
    );
  }

  // Markers, or nothing: an open note floats over the prose, just under its words.
  const floatAt = (top: number) => ({ top, left: geo.proseLeft, width: Math.min(320, geo.proseWidth) });
  const active = activeId ? anchorOf(activeId) : undefined;
  const activeNote = activeId ? byId.get(activeId) : undefined;
  // A dot (or its words) under the pointer shows the note without opening it.
  const peekId = geo.mode === "markers" && hoverId !== activeId ? hoverId : null;
  const peek = peekId ? anchorOf(peekId) : undefined;
  const peekNote = peekId ? byId.get(peekId) : undefined;
  return (
    <div ref={marginRef} className={styles.margin} aria-label="Notes">
      <style>{litRule}</style>
      {geo.mode === "markers" &&
        geo.anchors.map((a) => {
          const note = byId.get(a.id);
          return (
            <button
              key={a.id}
              type="button"
              className={styles.marker}
              data-kind={note?.kind}
              data-editorial={note?.type === "editorial" || undefined}
              style={{ top: a.top + a.height / 2 - 5, left: geo.proseLeft - 18 }}
              aria-label={`${note ? KIND_LABEL[note.kind] : "Note"}: ${note?.note || note?.anchor || ""}`}
              onMouseEnter={() => setHoverId(a.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(a.id)}
              onBlur={() => setHoverId(null)}
              onClick={() =>
                notes.setPopover({ open: true, isNew: false, noteId: a.id, rect: null, isEditing: false })
              }
            />
          );
        })}
      {peek && peekNote && <NotePeek note={peekNote} style={floatAt(peek.top + peek.height + 6)} />}
      {active && activeNote && (
        <NoteCard
          note={activeNote}
          notes={notes}
          active
          floating
          style={floatAt(active.top + active.height + 6)}
          onHover={setHoverId}
        />
      )}
      {newTop !== null && popover.open && popover.isNew && (
        <NewNoteCard notes={notes} floating style={floatAt(newTop + (geo.pending?.height ?? 20) + 6)} />
      )}
    </div>
  );
}
