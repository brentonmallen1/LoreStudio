/**
 * How the scene's notes show beside the prose (doc 15 polish): cards in the margin, or a dot
 * in the note's colour beside each line (the card opens on a click, a preview on hover).
 */
import { rememberPref } from "../preferences/accountPrefs";

export type NotesView = "cards" | "dots";

const KEY = "ls_notes_margin";

/** The old "off" (hidden) reads as dots: the quietest view left. */
export function readNotesView(): NotesView {
  try {
    const v = localStorage.getItem(KEY);
    return v === "off" || v === "dots" ? "dots" : "cards";
  } catch {
    return "cards";
  }
}

export function saveNotesView(view: NotesView): NotesView {
  rememberPref(KEY, view);
  return view;
}

/** Cards need room beside the prose; with too little they fall back to dots. */
export function marginMode(view: NotesView, room: number, minRoom: number): "cards" | "markers" {
  return view === "cards" && room >= minRoom ? "cards" : "markers";
}
