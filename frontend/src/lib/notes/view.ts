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

/** A full card and its gaps: how much room the margin wants beside the prose. */
export const CARD_ROOM = 300;

/**
 * How far to move the prose right so the notes' cards fit beside it (Brenton 2026-10-12: the
 * text is centred, and moves over only while cards are showing). `room` is the margin with
 * the prose centred, `spare` the space to its right. Nothing when cards fit already, or when
 * even the whole of `spare` would not make room for the narrowest card.
 */
export function notesShift(room: number, spare: number, minRoom: number): number {
  if (room >= CARD_ROOM) return 0;
  // Keep a little space on the right: the highlighted name's marks run down that edge.
  const shift = Math.min(CARD_ROOM - room, Math.max(0, spare - 24));
  return room + shift >= minRoom ? Math.round(shift) : 0;
}
