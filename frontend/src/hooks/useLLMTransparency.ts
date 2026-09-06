import { useState, useCallback } from "react";
import { api } from "../api/client";
import { aiCallsApi, type CallLookup } from "../api/aiCalls";
import type { LLMInteractionData, PromptPreviewRequest } from "../types";

/**
 * Tracks the response for an LLM interaction and opens the transparency view.
 *
 * When the feature is named, this shows the *call that ran* — its messages, its options,
 * its raw response, straight from the AI call log (doc 06 §3). It used to rebuild a
 * preview after the fact, which could differ from what actually went out. The preview
 * remains the fallback for a feature that has not run here yet: then it honestly answers
 * "what would be sent", not "what was sent".
 *
 * Usage:
 *   const t = useLLMTransparency();
 *
 *   // After streaming completes:
 *   t.recordInteraction(fullResponse);
 *
 *   // Button (enabled once there's been an interaction):
 *   <button disabled={!t.hasData} onClick={() => t.open({ context_type: "interview", interview_id: id }, lastResponse)}>
 *     Show AI context
 *   </button>
 *
 *   // Modal:
 *   <LLMTransparencyModal isOpen={t.isOpen} onClose={t.close} data={t.data} />
 */
export function useLLMTransparency() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<LLMInteractionData | null>(null);
  const [hasData, setHasData] = useState(false);

  /**
   * Open the transparency modal. Fetches the prompt preview from the backend
   * and combines it with the stored response text.
   */
  const open = useCallback(async (request: PromptPreviewRequest, response: string, call?: CallLookup) => {
    if (call?.feature) {
      try {
        const found = await aiCallsApi.latest(call);
        if (found) {
          setData({ callId: found.id, response });
          setIsOpen(true);
          return;
        }
      } catch {
        // Fall through to the preview: better a "what would be sent" than nothing.
      }
    }
    try {
      const preview = await api.getPromptPreview(request);
      setData({ preview, response });
    } catch {
      // Open modal anyway with whatever we have
    }
    setIsOpen(true);
  }, []);

  /**
   * Call this after each LLM streaming interaction completes to enable the button.
   */
  const recordInteraction = useCallback(() => {
    setHasData(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  return { isOpen, data, hasData, open, close, recordInteraction };
}
