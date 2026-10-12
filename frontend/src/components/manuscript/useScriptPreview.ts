import { useCallback, useEffect, useState } from "react";
import { scriptApi } from "../../api/script";
import { runningTime, useStoryFormat } from "../../lib/storyFormat";
import type { ScriptExportChoices, ScriptLayout, StoryFormat } from "../../types";

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

/** "12 pages · about 12 minutes on screen, at a minute a page". */
export function pagesSummary(pages: number, format: StoryFormat = "screenplay"): string {
  return `${pages} ${pages === 1 ? "page" : "pages"} · ${runningTime(pages, format)}`;
}
