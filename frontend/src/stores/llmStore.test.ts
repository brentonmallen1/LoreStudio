import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useLLMStore } from "./llmStore";

// Reset store state before each test
beforeEach(() => {
  useLLMStore.setState({ requests: {} });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useLLMStore", () => {
  describe("startRequest", () => {
    it("creates a new request with streaming status", () => {
      const { startRequest } = useLLMStore.getState();
      startRequest("req-1", "Test Label");

      const { requests } = useLLMStore.getState();
      expect(requests["req-1"]).toBeDefined();
      expect(requests["req-1"].status).toBe("streaming");
      expect(requests["req-1"].label).toBe("Test Label");
      expect(requests["req-1"].streamedText).toBe("");
    });

    it("returns an AbortController", () => {
      const { startRequest } = useLLMStore.getState();
      const controller = startRequest("req-1", "Test");
      expect(controller).toBeInstanceOf(AbortController);
    });

    it("cancels existing streaming request with same id", () => {
      const { startRequest } = useLLMStore.getState();
      const first = startRequest("req-1", "First");
      startRequest("req-1", "Second");
      expect(first.signal.aborted).toBe(true);
    });

    it("stores tabId when provided", () => {
      const { startRequest } = useLLMStore.getState();
      startRequest("req-1", "Label", "tab-abc");

      const { requests } = useLLMStore.getState();
      expect(requests["req-1"].tabId).toBe("tab-abc");
    });
  });

  describe("updateStream", () => {
    it("appends streamed text to request", () => {
      const { startRequest, updateStream } = useLLMStore.getState();
      startRequest("req-1", "Test");
      updateStream("req-1", "Hello ");
      updateStream("req-1", "Hello world");

      const { requests } = useLLMStore.getState();
      expect(requests["req-1"].streamedText).toBe("Hello world");
    });

    it("does nothing for unknown request id", () => {
      const { updateStream } = useLLMStore.getState();
      // Should not throw
      expect(() => updateStream("nonexistent", "text")).not.toThrow();
    });
  });

  describe("completeRequest", () => {
    it("marks request as complete", () => {
      const { startRequest, completeRequest } = useLLMStore.getState();
      startRequest("req-1", "Test");
      completeRequest("req-1");

      const { requests } = useLLMStore.getState();
      expect(requests["req-1"].status).toBe("complete");
    });

    it("auto-clears request without tabId after 3 seconds", () => {
      const { startRequest, completeRequest } = useLLMStore.getState();
      startRequest("req-1", "Test"); // no tabId
      completeRequest("req-1");

      vi.advanceTimersByTime(3001);

      const { requests } = useLLMStore.getState();
      expect(requests["req-1"]).toBeUndefined();
    });
  });

  describe("cancelRequest", () => {
    it("aborts the controller and marks request as cancelled", () => {
      const { startRequest, cancelRequest } = useLLMStore.getState();
      const controller = startRequest("req-1", "Test");
      cancelRequest("req-1");

      expect(controller.signal.aborted).toBe(true);
      const { requests } = useLLMStore.getState();
      expect(requests["req-1"].status).toBe("cancelled");
    });

    it("does nothing for unknown request id", () => {
      const { cancelRequest } = useLLMStore.getState();
      expect(() => cancelRequest("nonexistent")).not.toThrow();
    });
  });

  describe("errorRequest", () => {
    it("marks request as error", () => {
      const { startRequest, errorRequest } = useLLMStore.getState();
      startRequest("req-1", "Test");
      errorRequest("req-1");

      const { requests } = useLLMStore.getState();
      expect(requests["req-1"].status).toBe("error");
    });
  });

  describe("getActiveRequests", () => {
    it("returns only streaming requests", () => {
      const { startRequest, completeRequest, getActiveRequests } = useLLMStore.getState();
      startRequest("req-1", "Active");
      startRequest("req-2", "Also active");
      completeRequest("req-1");

      const active = getActiveRequests();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe("req-2");
    });

    it("returns empty array when no active requests", () => {
      const { getActiveRequests } = useLLMStore.getState();
      expect(getActiveRequests()).toHaveLength(0);
    });
  });

  describe("getTabStatus", () => {
    it("returns 'streaming' when tab has active request", () => {
      const { startRequest, getTabStatus } = useLLMStore.getState();
      startRequest("req-1", "Test", "my-tab");
      expect(getTabStatus("my-tab")).toBe("streaming");
    });

    it("returns 'unviewed' when tab has completed but unviewed request", () => {
      const { startRequest, completeRequest, getTabStatus } = useLLMStore.getState();
      startRequest("req-1", "Test", "my-tab");
      completeRequest("req-1");
      expect(getTabStatus("my-tab")).toBe("unviewed");
    });

    it("returns 'error' when tab has errored unviewed request", () => {
      const { startRequest, errorRequest, getTabStatus } = useLLMStore.getState();
      startRequest("req-1", "Test", "my-tab");
      errorRequest("req-1");
      expect(getTabStatus("my-tab")).toBe("error");
    });

    it("returns null when tab has no requests", () => {
      const { getTabStatus } = useLLMStore.getState();
      expect(getTabStatus("my-tab")).toBeNull();
    });

    it("returns null after request is viewed", () => {
      const { startRequest, completeRequest, markViewed, getTabStatus } = useLLMStore.getState();
      startRequest("req-1", "Test", "my-tab");
      completeRequest("req-1");
      markViewed("my-tab");

      // Advance timers to clear the request
      vi.advanceTimersByTime(3001);
      expect(getTabStatus("my-tab")).toBeNull();
    });
  });

  describe("hasActiveRequests", () => {
    it("returns true when streaming requests exist", () => {
      const { startRequest, hasActiveRequests } = useLLMStore.getState();
      startRequest("req-1", "Test");
      expect(hasActiveRequests()).toBe(true);
    });

    it("returns false when no streaming requests", () => {
      const { hasActiveRequests } = useLLMStore.getState();
      expect(hasActiveRequests()).toBe(false);
    });
  });
});
