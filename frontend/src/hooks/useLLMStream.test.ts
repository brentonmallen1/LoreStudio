import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLLMStream } from "./useLLMStream";
import { useLLMStore } from "../stores/llmStore";

beforeEach(() => {
  useLLMStore.setState({ requests: {} });
});

/** Build a mock Response that streams the given text. */
function mockStreamResponse(text: string, ok = true): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const char of text) {
        controller.enqueue(encoder.encode(char));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: ok ? 200 : 500,
    headers: { "Content-Type": "text/plain" },
  });
}

describe("useLLMStream", () => {
  it("streams text and updates store", async () => {
    const { result } = renderHook(() =>
      useLLMStream({ requestId: "test-req", label: "Test Stream" })
    );

    let finalText: string | null = null;
    await act(async () => {
      finalText = await result.current.stream(() =>
        Promise.resolve(mockStreamResponse("Hello world"))
      );
    });

    expect(finalText).toBe("Hello world");
    expect(result.current.text).toBe("Hello world");
    expect(result.current.status).toBe("complete");
  });

  it("calls onComplete with full text", async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useLLMStream({ requestId: "test-req", label: "Test", onComplete })
    );

    await act(async () => {
      await result.current.stream(() =>
        Promise.resolve(mockStreamResponse("Done!"))
      );
    });

    expect(onComplete).toHaveBeenCalledWith("Done!");
  });

  it("marks status as error on failed response", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useLLMStream({ requestId: "test-req", label: "Test", onError })
    );

    await act(async () => {
      await result.current.stream(() =>
        Promise.resolve(mockStreamResponse("", false)) // ok=false
      );
    });

    expect(result.current.status).toBe("error");
    expect(onError).toHaveBeenCalled();
  });

  it("cancel aborts the request", async () => {
    const { result } = renderHook(() =>
      useLLMStream({ requestId: "test-req", label: "Test" })
    );

    // Start a never-resolving stream
    let resolveAbort!: () => void;
    const abortPromise = new Promise<void>((res) => { resolveAbort = res; });

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
    const { result } = renderHook(() =>
      useLLMStream({ requestId: "idle-req", label: "Idle" })
    );

    expect(result.current.text).toBe("");
    expect(result.current.status).toBe("idle");
    expect(result.current.isStreaming).toBe(false);
  });
});
