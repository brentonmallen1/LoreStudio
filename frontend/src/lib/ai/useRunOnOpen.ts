import { useEffect, useRef } from "react";

/**
 * Run an analysis as its panel opens (doc 18): the Assistant row's "Analyse the twist" opened
 * a panel that then asked for a second click on "Analyze". Runs again when `key` changes.
 */
export function useRunOnOpen(run: () => void, key: string, enabled = true): void {
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => runRef.current(), 0);
    return () => clearTimeout(t);
  }, [key, enabled]);
}
