import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { ContextSource, PromptPreviewRequest } from "../types";

export function useLLMContextSources(request: PromptPreviewRequest | null) {
  const [sources, setSources] = useState<ContextSource[]>([]);
  const [loading, setLoading] = useState(false);

  // Derive a stable string key so we only re-fetch when params actually change
  const key = request ? JSON.stringify(request) : null;

  useEffect(() => {
    if (!key || !request) {
      setSources([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.getPromptPreview(request)
      .then((preview) => {
        if (!cancelled) setSources(preview.sources ?? []);
      })
      .catch(() => {
        if (!cancelled) setSources([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [key]);

  return { sources, loading };
}
