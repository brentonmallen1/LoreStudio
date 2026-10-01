import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { AI_FEATURES } from "../../lib/ai/features.generated";

/** Names for the checks made on this machine, which are not Assistant features. */
const LOCAL_LABELS: Record<string, string> = {
  "prose-analysis": "Prose check",
  "editorial-consistency": "Tense and point of view",
  "entity-suggestions": "Name scan",
};

export function featureLabel(id: string): string {
  return LOCAL_LABELS[id] ?? AI_FEATURES.find((f) => f.id === id)?.label ?? id;
}

/** Which checks have runs in this story, for the Analyses filter's chips (doc 13 P6). */
export function useRunFeatures(storyId: string, on: boolean, excludeAI: boolean): string[] {
  const [features, setFeatures] = useState<string[]>([]);
  useEffect(() => {
    if (!on) return;
    let live = true;
    api
      .chronicleTimeline({ story_id: storyId, filter: "analyses", exclude_ai: excludeAI, limit: 500 })
      .then((r) => {
        const seen = new Set<string>();
        for (const e of r.entries) {
          const f = e.log?.metadata_?.feature;
          if (typeof f === "string") seen.add(f);
        }
        if (live) setFeatures([...seen].sort((a, b) => featureLabel(a).localeCompare(featureLabel(b))));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [storyId, on, excludeAI]);
  return features;
}
