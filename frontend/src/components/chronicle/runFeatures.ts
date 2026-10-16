import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { featureLabel } from "./timelineFormat";

export { featureLabel };

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
