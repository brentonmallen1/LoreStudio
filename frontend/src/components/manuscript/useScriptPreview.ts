import { useCallback, useEffect, useState } from "react";
import { scriptApi } from "../../api/script";
import { useStoryFormat } from "../../lib/storyFormat";
import type { ScriptExportChoices, ScriptLayout } from "../../types";

export const DEFAULT_CHOICES: ScriptExportChoices = {
  title_page: true,
  scene_numbers: false,
  bold_headings: false,
  page_size: "letter",
  auto_contd: true,
};

/**
 * A screenplay's printed pages for the manuscript view (doc 25, P3), drawn with the export's own
 * choices so the preview and the PDF agree. Nothing is fetched for prose.
 */
export function useScriptPreview(storyId: string, statusFilter: string | undefined) {
  const script = useStoryFormat() !== "prose";
  const [choices, setChoices] = useState<ScriptExportChoices>(DEFAULT_CHOICES);
  const [layout, setLayout] = useState<ScriptLayout | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!script) return;
    let live = true;
    scriptApi
      .getScriptLayout(storyId, choices, statusFilter)
      .then((l) => live && setLayout(l))
      .catch(() => live && setLayout(null));
    return () => {
      live = false;
    };
  }, [script, storyId, statusFilter, choices, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { script, choices, setChoices, layout, reload };
}

/** "12 pages · about 12 minutes": a page of script is about a minute on screen. */
export function pagesSummary(pages: number, format: string = "screenplay"): string {
  const where = format === "stage_play" ? "on stage" : "on screen";
  if (pages === 1) return `1 page · about a minute ${where}`;
  return `${pages} pages · about ${pages} minutes ${where}`;
}
