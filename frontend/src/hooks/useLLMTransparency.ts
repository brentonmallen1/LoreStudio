import { useState, useCallback } from "react";
import { api } from "../api/client";
import type { LLMInteractionData, PromptPreviewRequest } from "../types";

/**
 * Tracks the response for an LLM interaction and provides a way to open a
 * transparency modal showing exactly what was sent to and received from the AI.
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
  const open = useCallback(async (request: PromptPreviewRequest, response: string) => {
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
