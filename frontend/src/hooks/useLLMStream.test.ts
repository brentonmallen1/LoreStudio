import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLLMStream } from "./useLLMStream";
import { useLLMStore } from "../stores/llmStore";

beforeEach(() => {
  useLLMStore.setState({ requests: {} });
});

/** Build a mock Response streaming the given text as typed events, a character at a time. */
function mockStreamResponse(text: string, ok = true, thinking = ""): Response {
  const encoder = new TextEncoder();
  const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const stream = new ReadableStream({
    start(controller) {
      for (const char of thinking) controller.enqueue(encoder.encode(frame("thinking", { delta: char })));
      for (const char of text) controller.enqueue(encoder.encode(frame("token", { delta: char })));
      controller.enqueue(encoder.encode(frame("done", {})));
      controller.close();
    },
  });
  return new Response(stream, {
    status: ok ? 200 : 500,
    headers: { "Content-Type": "text/event-stream" },
  });
}

/** A response whose stream carries an error event partway through. */
function mockFailingResponse(text: string, message: string): Response {
  const encoder = new TextEncoder();
  const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(frame("token", { delta: text })));
      controller.enqueue(encoder.encode(frame("error", { message, where: "test" })));
      controller.enqueue(encoder.encode(frame("done", {})));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

describe("useLLMStream", () => {
  it("streams text and updates store", async () => {
    const { result } = renderHook(() => useLLMStream({ requestId: "test-req", label: "Test Stream" }));

    let finalText: string | null = null;
    await act(async () => {
      finalText = await result.current.stream(() => Promise.resolve(mockStreamResponse("Hello world")));
    });

    expect(finalText).toBe("Hello world");
    expect(result.current.text).toBe("Hello world");
    expect(result.current.status).toBe("complete");
  });

  it("calls onComplete with full text", async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useLLMStream({ requestId: "test-req", label: "Test", onComplete }));

    await act(async () => {
      await result.current.stream(() => Promise.resolve(mockStreamResponse("Done!")));
    });

    expect(onComplete).toHaveBeenCalledWith("Done!", "");
  });

  it("marks status as error on failed response", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useLLMStream({ requestId: "test-req", label: "Test", onError }));

    await act(async () => {
      await result.current.stream(
        () => Promise.resolve(mockStreamResponse("", false)), // ok=false
      );
    });

    expect(result.current.status).toBe("error");
    expect(onError).toHaveBeenCalled();
  });

  it("cancel aborts the request", async () => {
    const { result } = renderHook(() => useLLMStream({ requestId: "test-req", label: "Test" }));

    // Start a never-resolving stream
    let resolveAbort!: () => void;
    const abortPromise = new Promise<void>((res) => {
      resolveAbort = res;
    });

    act(() => {
      result.current.stream(async (signal) => {
        await new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          abortPromise.then(() => reject(new DOMException("aborted", "AbortError")));
        });
        return mockStreamResponse(""); // never reached
      });
    });

    // Cancel it
    act(() => {
      result.current.cancel();
      resolveAbort();
    });

    // Give it a moment to settle
    await act(async () => {});

    expect(result.current.status).toBe("cancelled");
  });

  it("returns empty string for text when no stream started", () => {
    const { result } = renderHook(() => useLLMStream({ requestId: "idle-req", label: "Idle" }));

    expect(result.current.text).toBe("");
    expect(result.current.status).toBe("idle");
    expect(result.current.isStreaming).toBe(false);
  });

  it("keeps reasoning out of the answer", async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useLLMStream({ requestId: "test-req", label: "Test", onComplete }));

    await act(async () => {
      await result.current.stream(() => Promise.resolve(mockStreamResponse("Yes.", true, "weighing it")));
    });

    expect(result.current.text).toBe("Yes.");
    expect(result.current.thinking).toBe("weighing it");
    expect(onComplete).toHaveBeenCalledWith("Yes.", "weighing it");
  });

  it("marks a request that failed mid-stream as errored rather than complete", async () => {
    const onError = vi.fn();
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useLLMStream({ requestId: "test-req", label: "Test", onError, onComplete }),
    );

    let returned: string | null = "unset";
    await act(async () => {
      returned = await result.current.stream(() =>
        Promise.resolve(mockFailingResponse("As far as this", "The model could not be reached.")),
      );
    });

    // The error used to arrive as prose, so the request "completed" with it as the answer.
    expect(returned).toBeNull();
    expect(result.current.status).toBe("error");
    expect(onError).toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
