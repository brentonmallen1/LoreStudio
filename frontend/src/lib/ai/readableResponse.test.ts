import { describe, expect, it } from "vitest";
import { readResponse, stripFences } from "./readableResponse";

describe("a response, read for people", () => {
  it("parses JSON the model wrapped in a code fence", () => {
    const raw = '```json\n{"festivals": ["The Lamp Night"], "questions": []}\n```';
    expect(readResponse(raw)).toEqual({
      kind: "json",
      data: { festivals: ["The Lamp Night"], questions: [] },
    });
    expect(stripFences("```\n[1, 2]\n```")).toBe("[1, 2]");
  });

  it("parses plain JSON, objects and lists alike", () => {
    expect(readResponse('  {"a": 1}  ')).toEqual({ kind: "json", data: { a: 1 } });
    expect(readResponse("[1, 2]")).toEqual({ kind: "json", data: [1, 2] });
  });

  it("leaves prose as text, to be shown as Markdown", () => {
    const prose = "The keeper **never** leaves the lamp.\n\n- one\n- two";
    expect(readResponse(prose)).toEqual({ kind: "text", text: prose });
    // A fence inside prose is part of the prose.
    const mixed = 'Here it is:\n```json\n{"a": 1}\n```';
    expect(readResponse(mixed)).toEqual({ kind: "text", text: mixed });
  });

  it("shows broken JSON as text rather than nothing", () => {
    const broken = '```json\n{"festivals": ["The Lamp Night",\n```';
    expect(readResponse(broken)).toEqual({ kind: "text", text: broken });
    expect(readResponse('{"a": ')).toEqual({ kind: "text", text: '{"a":' });
  });

  it("says when there is nothing", () => {
    expect(readResponse("")).toEqual({ kind: "empty" });
    expect(readResponse("  \n ")).toEqual({ kind: "empty" });
    expect(readResponse(null)).toEqual({ kind: "empty" });
  });
});
