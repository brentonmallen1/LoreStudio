import { readEventStream } from "../lib/ai/eventStream";
import { useLLMStore } from "../stores/llmStore";

export interface UseLLMStreamOptions {
  requestId: string;
  label: string;
  tabId?: string;
  onComplete?: (text: string, thinking: string) => void;
  onError?: () => void;
}

export function useLLMStream({ requestId, label, tabId, onComplete, onError }: UseLLMStreamOptions) {
  const startRequest = useLLMStore((s) => s.startRequest);
  const updateStream = useLLMStore((s) => s.updateStream);
  const updateThinking = useLLMStore((s) => s.updateThinking);
  const completeRequest = useLLMStore((s) => s.completeRequest);
  const errorRequest = useLLMStore((s) => s.errorRequest);
  const cancelRequest = useLLMStore((s) => s.cancelRequest);
  const request = useLLMStore((s) => s.requests[requestId]);

  const stream = async (fetchFn: (signal: AbortSignal) => Promise<Response>): Promise<string | null> => {
    const controller = startRequest(requestId, label, tabId);

    try {
      const res = await fetchFn(controller.signal);
      if (!res.ok || !res.body) throw new Error("Stream failed");

      const {
        text: full,
        thinking,
        error,
      } = await readEventStream(res, {
        onToken: (text) => updateStream(requestId, text),
        onThinking: (reasoning) => updateThinking(requestId, reasoning),
      });

      // A failure now has its own event, so a request that failed is marked failed rather
      // than completing with the error message as its result.
      if (error) {
        errorRequest(requestId);
        onError?.();
        return null;
      }

      completeRequest(requestId);
      onComplete?.(full, thinking);
      return full;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // Already marked cancelled via cancelRequest
        return null;
      }
      errorRequest(requestId);
      onError?.();
      return null;
    }
  };

  const cancel = () => cancelRequest(requestId);

  return {
    stream,
    cancel,
    text: request?.streamedText ?? "",
    thinking: request?.streamedThinking ?? "",
    status: request?.status ?? "idle",
    isStreaming: request?.status === "streaming",
  };
}
