import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { HELPERS } from "../../lib/typing/helpers";
import { useTypingStore } from "../../stores/typingStore";
import TypingGuide from "./TypingGuide";

/** The Typing guide's list (doc 26, P2): every helper, grouped, a tick on each one used. */
describe("TypingGuide", () => {
  beforeEach(() => useTypingStore.setState({ used: new Set() }));

  it("lists every helper under its group", () => {
    render(<TypingGuide />);
    for (const h of HELPERS) expect(screen.getByText(h.label)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Giving someone a line" })).toBeTruthy();
    expect(screen.getByText(/None used yet/)).toBeTruthy();
  });

  it("ticks the ones used", () => {
    useTypingStore.setState({ used: new Set(["line", "mention"]) });
    render(<TypingGuide />);
    expect(screen.getByText(`2 of ${HELPERS.length} used.`)).toBeTruthy();
    expect(screen.getAllByLabelText("Used")).toHaveLength(2);
  });
});
