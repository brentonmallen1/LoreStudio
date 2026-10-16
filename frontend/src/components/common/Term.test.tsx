import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Term from "./Term";
import TermText from "./TermText";
import { isNew, noteOpened, noteShown, resetSeenForTests } from "../../lib/glossary/seen";
import { PREFS_ADOPTED_EVENT } from "../../lib/preferences/accountPrefs";
import { useAuthStore } from "../../stores/authStore";
import type { User } from "../../types";

function asMode(mode: "writer" | "studio") {
  useAuthStore.setState({ user: { id: "u1", settings: { ui: { mode } } } as unknown as User });
}

describe("Term", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSeenForTests();
    asMode("studio");
  });
  afterEach(() => useAuthStore.setState({ user: null }));

  it("is a button with a dotted word that opens its definition, example and glossary link", () => {
    render(
      <p>
        Write your <Term id="logline">logline</Term> first.
      </p>,
    );
    const word = screen.getByRole("button", { name: /logline/ });
    expect(word.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(word);
    expect(word.getAttribute("aria-expanded")).toBe("true");
    const pop = screen.getByRole("dialog", { name: "Logline" });
    expect(pop.textContent).toContain("One sentence that says what your story is");
    expect(pop.textContent).toContain("From The Last Lighthouse");
    expect(pop.textContent).toContain("Also called: pitch");
    const link = screen.getByRole("link", { name: "More in the glossary" });
    expect(link.getAttribute("href")).toBe("/guides/glossary#logline");
  });

  it("closes on Escape and gives the focus back to the word", () => {
    render(<Term id="beat">beat</Term>);
    const word = screen.getByRole("button", { name: /beat/ });
    fireEvent.click(word);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(word.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(word);
  });

  it("wears a (?) the first time, and loses it once opened", () => {
    const { container } = render(<Term id="arc">arc</Term>);
    expect(container.textContent).toBe("arc?");
    fireEvent.click(screen.getByRole("button"));
    expect(container.textContent).toBe("arc");
  });

  it("is plain text for a Studio-only word in Writer mode", () => {
    asMode("writer");
    const { container } = render(<Term id="codex">Codex</Term>);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.textContent).toBe("Codex");
  });

  it("draws the marks in copy kept as data", () => {
    const { container } = render(<TermText text="Name each {{term:mice|MICE}} thread." />);
    expect(screen.getByRole("button", { name: /MICE/ })).toBeTruthy();
    expect(container.textContent).toBe("Name each MICE? thread.");
  });
});

describe("terms already met", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSeenForTests();
  });

  it("keeps a word shown this visit, and calls it met from the next", () => {
    noteShown("logline");
    expect(isNew("logline")).toBe(true);
    expect(JSON.parse(localStorage.getItem("ls_terms_seen")!)).toEqual(["logline"]);
    resetSeenForTests();
    expect(isNew("logline")).toBe(false);
  });

  it("calls a word met as soon as it is opened", () => {
    noteOpened("beat");
    expect(isNew("beat")).toBe(false);
  });

  it("learns what the account already met", () => {
    localStorage.setItem("ls_terms_seen", JSON.stringify(["foil"]));
    act(() => {
      window.dispatchEvent(new Event(PREFS_ADOPTED_EVENT));
    });
    expect(isNew("foil")).toBe(false);
  });

  it("treats a damaged value as nothing met", () => {
    localStorage.setItem("ls_terms_seen", "{not json");
    resetSeenForTests();
    expect(isNew("logline")).toBe(true);
  });
});
