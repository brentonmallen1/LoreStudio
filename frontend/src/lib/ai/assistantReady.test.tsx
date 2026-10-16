import { describe, expect, it, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { Orbit, Feather } from "lucide-react";
import { needsAssistant } from "./assistantReady";
import { requireAssistant, useAssistantSetup } from "../../stores/assistantSetupStore";
import { getMode, welcomePending } from "../mode";
import { useAuthStore } from "../../stores/authStore";
import type { User } from "../../types";

describe("the setup gate (doc 30 D4)", () => {
  beforeEach(() => useAssistantSetup.setState({ status: "unknown", setupOpen: false, checkedAt: 0 }));

  it("knows an Assistant action by its mark or its one-shot icon", () => {
    const { getByText } = render(
      <div>
        <span data-needs-assistant="">
          <button type="button">Suggest relationships</button>
        </span>
        <button type="button">
          <Orbit size={12} /> Summarize
        </button>
        <button type="button">
          <Feather size={12} /> Talk it over
        </button>
        <button type="button">Add a character</button>
        <section data-assistant-setup>
          <button type="button">
            <Orbit size={12} /> Check again
          </button>
        </section>
      </div>,
    );
    expect(needsAssistant(getByText("Suggest relationships"))).toBe(true);
    expect(needsAssistant(getByText("Summarize"))).toBe(true);
    expect(needsAssistant(getByText("Talk it over"))).toBe(false);
    expect(needsAssistant(getByText("Add a character"))).toBe(false);
    expect(needsAssistant(getByText("Check again"))).toBe(false);
  });

  it("lets an action through until a check finds no model, then opens the card", () => {
    expect(requireAssistant()).toBe(true);
    useAssistantSetup.setState({ status: "ready" });
    expect(requireAssistant()).toBe(true);
    useAssistantSetup.setState({ status: "not-ready" });
    expect(requireAssistant()).toBe(false);
    expect(useAssistantSetup.getState().setupOpen).toBe(true);
  });
});

describe("the welcome question (doc 30 D4)", () => {
  const as = (settings: Record<string, unknown>) =>
    useAuthStore.setState({
      user: { id: "u", username: "u", display_name: "U", is_admin: false, settings } as User,
    });

  it("shows no AI to a new account until it answers", () => {
    as({ ui: { welcome: "ask" } });
    expect(welcomePending(useAuthStore.getState().user?.settings)).toBe(true);
    expect(getMode()).toBe("writer");
    as({ ui: { welcome: "done", mode: "studio" } });
    expect(getMode()).toBe("studio");
  });

  it("never asks an account from before, which keeps Studio", () => {
    as({});
    expect(welcomePending(useAuthStore.getState().user?.settings)).toBe(false);
    expect(getMode()).toBe("studio");
    as({ ui: { mode: "writer" } });
    expect(getMode()).toBe("writer");
  });
});
