import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { ContextSource, PromptPreviewRequest, TokenBreakdown } from "../types";

export function useLLMContextSources(request: PromptPreviewRequest | null) {
  const [sources, setSources] = useState<ContextSource[]>([]);
  const [tokenBreakdown, setTokenBreakdown] = useState<TokenBreakdown | null>(null);
  const [loading, setLoading] = useState(false);

  // Derive a stable string key so we only re-fetch when params actually change
  const key = request ? JSON.stringify(request) : null;

  useEffect(() => {
    if (!key || !request) {
      setSources([]);
      setTokenBreakdown(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.getPromptPreview(request)
      .then((preview) => {
        if (!cancelled) {
          setSources(preview.sources ?? []);
          setTokenBreakdown(preview.token_breakdown ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSources([]);
          setTokenBreakdown(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [key]);

  return { sources, tokenBreakdown, loading };
}
