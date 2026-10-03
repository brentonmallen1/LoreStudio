import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CommitInput from "./CommitInput";

describe("CommitInput", () => {
  it("saves once, when you leave it, not on every key", () => {
    const onCommit = vi.fn();
    render(<CommitInput value="ash" onCommit={onCommit} aria-label="clue" />);
    const input = screen.getByLabelText("clue") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ash by" } });
    fireEvent.change(input, { target: { value: "ash by the cabinet" } });
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe("ash by the cabinet");
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("ash by the cabinet");
  });

  it("Escape puts the saved text back and saves nothing", () => {
    const onCommit = vi.fn();
    render(<CommitInput value="ash" onCommit={onCommit} aria-label="clue" />);
    const input = screen.getByLabelText("clue") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "oops" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe("ash");
  });
});
