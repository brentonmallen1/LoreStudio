import { useState } from "react";

const key = (id: string) => `ls_panel_fold:${id}`;

/**
 * Whether a section of the This scene tab is open, remembered per browser like the panel's
 * other layout choices. A section stays as the author left it from scene to scene, so
 * stepping through the story compares the same things.
 */
export function useFoldOpen(id: string, initial: boolean): [boolean, (open: boolean) => void] {
  const [open, setOpenState] = useState(() => {
    try {
      const saved = localStorage.getItem(key(id));
      return saved === null ? initial : saved === "1";
    } catch {
      return initial;
    }
  });
  function setOpen(next: boolean) {
    setOpenState(next);
    try {
      localStorage.setItem(key(id), next ? "1" : "0");
    } catch {
      // Site data blocked: it still folds, it just forgets.
    }
  }
  return [open, setOpen];
}
