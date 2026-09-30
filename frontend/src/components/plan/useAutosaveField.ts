import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A text field that saves itself a moment after the author stops typing, and on unmount,
 * so leaving a step never drops the last words. Key the component by what it edits: the
 * initial value is read once.
 */
export function useAutosaveField(initial: string, save: (value: string) => Promise<unknown>, delay = 600) {
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<string | null>(null);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current === null) return;
    const next = pending.current;
    pending.current = null;
    void saveRef.current(next);
  }, []);

  useEffect(() => flush, [flush]);

  const change = useCallback(
    (next: string) => {
      setValue(next);
      pending.current = next;
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  return { value, change, flush };
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}
