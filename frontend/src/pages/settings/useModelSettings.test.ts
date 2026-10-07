import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const saved = {
  temperature: 1,
  top_p: 0.95,
  top_k: 64,
  thinking_enabled: false,
  image_token_budget: 280,
  num_ctx_max: null,
  is_default: false,
  ollama_url: "http://lamp:11434",
  ollama_model: null,
  effective_ollama_url: "http://lamp:11434",
  effective_ollama_model: "gemma4",
};

const update = vi.fn().mockResolvedValue(saved);
vi.mock("../../api/client", () => ({
  api: {
    getLLMSettings: () => Promise.resolve(saved),
    updateLLMSettings: (...args: unknown[]) => update(...args),
  },
}));

import { useModelSettings } from "./useModelSettings";

afterEach(() => {
  update.mockClear();
});

describe("useModelSettings", () => {
  it("does not save what it just loaded", async () => {
    const { result } = renderHook(() => useModelSettings());
    await waitFor(() => expect(result.current.params).not.toBeNull());
    await new Promise((r) => setTimeout(r, 900)); // past both debounces
    expect(update).not.toHaveBeenCalled();
  });

  it("saves a change, and Default clears the image budget", async () => {
    const { result } = renderHook(() => useModelSettings());
    await waitFor(() => expect(result.current.params).not.toBeNull());
    act(() => result.current.setParam("image_token_budget", 0));
    await waitFor(() => expect(update).toHaveBeenCalledOnce(), { timeout: 1500 });
    expect(update.mock.calls[0][0]).toEqual({ image_token_budget: null });
  });
});
