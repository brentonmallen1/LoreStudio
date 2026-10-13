import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { markUsed, useTypingStore } from "../../stores/typingStore";
import Practice from "./Practice";
import { useTried } from "./useTried";
import PracticeSandbox from "./PracticeSandbox";

/** Things to try, ticking off as each helper does its work (doc 26, P5). */
function Steps() {
  const tried = useTried();
  return (
    <Practice
      steps={[
        { id: "line", task: "Give someone a line" },
        { id: "mention", task: "Name Eleanor" },
      ]}
      tried={tried}
    />
  );
}

describe("Practice", () => {
  // Used before is not tried here: the steps tick for what is done now.
  beforeEach(() => useTypingStore.setState({ used: new Set(["line"]) }));

  it("ticks a step when its helper is used, even one used before", () => {
    render(<Steps />);
    expect(screen.getByText("0 of 2 tried")).toBeTruthy();
    expect(screen.getAllByLabelText("Not tried yet")).toHaveLength(2);
    act(() => markUsed("line"));
    expect(screen.getByText("1 of 2 tried")).toBeTruthy();
    expect(screen.getByText("Give someone a line").closest("li")?.getAttribute("data-done")).toBe("true");
    expect(screen.getAllByText("^")).toHaveLength(1);
  });

  it("starts again in the sandbox, with nothing tried", () => {
    render(<PracticeSandbox />);
    act(() => markUsed("place"));
    expect(screen.getByText("1 of 5 tried")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start again" }));
    expect(screen.getByText("0 of 5 tried")).toBeTruthy();
    expect(screen.getByLabelText("Practice text").textContent).toContain("“Run,”");
  });
});
