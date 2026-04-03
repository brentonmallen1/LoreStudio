import { useLLMStore } from "../stores/llmStore";

export interface UseLLMStreamOptions {
  requestId: string;
  label: string;
  onComplete?: (text: string) => void;
  onError?: () => void;
}

export function useLLMStream({ requestId, label, onComplete, onError }: UseLLMStreamOptions) {
  const startRequest = useLLMStore((s) => s.startRequest);
  const updateStream = useLLMStore((s) => s.updateStream);
  const completeRequest = useLLMStore((s) => s.completeRequest);
  const errorRequest = useLLMStore((s) => s.errorRequest);
  const cancelRequest = useLLMStore((s) => s.cancelRequest);
  const request = useLLMStore((s) => s.requests[requestId]);

  const stream = async (fetchFn: (signal: AbortSignal) => Promise<Response>): Promise<string | null> => {
    const controller = startRequest(requestId, label);

    try {
      const res = await fetchFn(controller.signal);
      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        updateStream(requestId, full);
      }

      completeRequest(requestId);
      onComplete?.(full);
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
    status: request?.status ?? "idle",
    isStreaming: request?.status === "streaming",
  };
}
