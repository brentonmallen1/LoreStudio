/**
 * The Outline's keys (doc 29 D2), as a reducer from a key press to what it does, so the
 * component only carries it out. Typing in a line:
 * - Enter adds the next line (under an open part, its first);
 * - Tab tucks the line under the one above; Shift+Tab moves it out;
 * - ↑ and ↓ go to the line above or below;
 * - → at the end of a title goes on to what happens, ← at its start comes back;
 * - Backspace in an empty new line takes it away;
 * - Esc leaves the text for the row, so Tab reaches the row's buttons.
 * On a row: Enter or F2 edits it, ↑ ↓ move, → unfolds and ← folds.
 */

export type Field = "title" | "synopsis";

export interface KeyPress {
  key: string;
  shift: boolean;
  /** ⌘, Ctrl or Alt held: the app's shortcuts, never the Outline's. */
  mod: boolean;
  /** An input method is composing (Japanese, accents): its keys are its own. */
  composing?: boolean;
  /** Where the focus is: one of a line's fields, or the row itself. */
  at: Field | "row";
  caretStart?: boolean;
  caretEnd?: boolean;
  empty?: boolean;
}

export type KeyAction =
  | "add-next"
  | "indent"
  | "outdent"
  | "up"
  | "down"
  | "to-row"
  | "to-title"
  | "to-synopsis"
  | "remove-empty"
  | "edit"
  | "fold"
  | "unfold";

export function outlineKey(press: KeyPress): KeyAction | null {
  if (press.mod || press.composing) return null;
  const { key, shift, at } = press;
  if (key === "ArrowUp") return "up";
  if (key === "ArrowDown") return "down";
  if (at === "row") {
    if (key === "Enter" || key === "F2") return "edit";
    if (key === "ArrowRight") return "unfold";
    if (key === "ArrowLeft") return "fold";
    return null;
  }
  if (key === "Enter" && !shift) return "add-next";
  if (key === "Tab") return shift ? "outdent" : "indent";
  if (key === "Escape") return "to-row";
  if (key === "ArrowRight" && at === "title" && press.caretEnd && !shift) return "to-synopsis";
  if (key === "ArrowLeft" && at === "synopsis" && press.caretStart && !shift) return "to-title";
  if (key === "Backspace" && at === "title" && press.empty) return "remove-empty";
  return null;
}
