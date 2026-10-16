import { useCallback, useRef, useState } from "react";
import { scenesBetween } from "../../lib/outline/selection";
import type { Row } from "../../lib/outline/tree";

/**
 * The scenes chosen in the Outline List to wrap in a chapter (doc 29 D6). Shift+click or
 * Shift+↑ ↓ chooses from where the choice began to the row reached; a plain click or Esc
 * lets them go.
 */
export function useChosen() {
  const [ids, setIds] = useState<string[]>([]);
  const anchor = useRef<string | null>(null);
  const extend = useCallback((rows: Row[], from: string, to: string) => {
    anchor.current = anchor.current ?? from;
    setIds(scenesBetween(rows, anchor.current, to));
  }, []);
  const clear = useCallback(() => {
    anchor.current = null;
    setIds((prev) => (prev.length ? [] : prev));
  }, []);
  return { ids, has: (id: string) => ids.includes(id), extend, clear };
}
