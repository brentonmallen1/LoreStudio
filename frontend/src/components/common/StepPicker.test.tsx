import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StepPicker from "./StepPicker";

const items = [
  { id: "idea", label: "Your idea in a sentence", done: true },
  { id: "who", label: "Who it's about", done: true },
  { id: "question", label: "What question your story asks", done: false },
  { id: "write", label: "Write the first scene", done: false },
];

describe("the step picker", () => {
  it("names the step you are on, lists every step with its done marks, and moves on a choice", () => {
    const onSelect = vi.fn();
    render(
      <StepPicker
        label="Steps"
        items={items}
        current={2}
        onSelect={onSelect}
        lead="Step 3 of 4 ·"
        numbered
      />,
    );
    const button = screen.getByRole("button", { name: /Step 3 of 4 · What question your story asks/ });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(button);
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Your idea in a sentence",
      "Who it's about",
      "3What question your story asks",
      "4Write the first scene",
    ]);
    expect(screen.getAllByLabelText("done")).toHaveLength(2);
    expect(options[2].getAttribute("aria-selected")).toBe("true");
    fireEvent.click(options[3]);
    expect(onSelect).toHaveBeenCalledWith(3);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
