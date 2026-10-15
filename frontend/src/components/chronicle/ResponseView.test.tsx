import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AICall } from "../../api/aiCalls";
import ResponseView from "./ResponseView";

function call(feature: string, element_type: string | null = null): AICall {
  return {
    id: "c1",
    feature,
    feature_label: feature,
    classification: null,
    story_id: null,
    created_at: "2026-10-15T00:00:00Z",
    status: "ok",
    model: null,
    tokens_in: null,
    tokens_out: null,
    latency_ms: null,
    starred: false,
    element_type,
    payload: null,
  };
}

describe("a call's response in the Chronicle", () => {
  it("is readable by default, in its feature's shape, and raw on request", () => {
    const raw = '```json\n{"naming_directions": ["Names from the tide tables"], "questions": []}\n```';
    render(<ResponseView call={call("element-suggest", "culture")} raw={raw} />);
    expect(screen.getByText("Naming directions")).toBeTruthy();
    expect(screen.getByText("Names from the tide tables")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Raw" }));
    expect(screen.getByText(/```json/)).toBeTruthy();
  });

  it("lays out JSON with no schema field by field, and prose as Markdown", () => {
    const { unmount } = render(
      <ResponseView call={call("plot-holes")} raw='{"open_questions": ["Who lit it?"]}' />,
    );
    expect(screen.getByText("open questions")).toBeTruthy();
    unmount();
    render(<ResponseView call={call("scene-chat")} raw={"The lamp **burns**."} />);
    expect(screen.getByText("burns").tagName).toBe("STRONG");
  });
});
