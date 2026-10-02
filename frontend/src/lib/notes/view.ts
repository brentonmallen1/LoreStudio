/**
 * How the scene's notes show beside the prose (doc 15 polish): cards in the margin, a dot
 * in the note's colour beside each line (the card opens on a click, a preview on hover),
 * or nothing at all, highlights included, for reading straight through.
 */
export type NotesView = "cards" | "dots" | "off";

export const NOTES_VIEWS: { id: NotesView; label: string }[] = [
  { id: "cards", label: "Beside the text" },
  { id: "dots", label: "As dots" },
  { id: "off", label: "Hidden" },
];

const KEY = "ls_notes_margin";

export function readNotesView(): NotesView {
  try {
    const v = localStorage.getItem(KEY);
    return v === "off" || v === "dots" ? v : "cards";
  } catch {
    return "cards";
  }
}

export function saveNotesView(view: NotesView): NotesView {
  try {
    localStorage.setItem(KEY, view);
  } catch {
    /* a private window keeps the choice for this visit only */
  }
  return view;
}

/** Cards need room beside the prose; with too little they fall back to dots. */
export function marginMode(view: NotesView, room: number, minRoom: number): "cards" | "markers" | "none" {
  if (view === "off") return "none";
  return view === "cards" && room >= minRoom ? "cards" : "markers";
}
