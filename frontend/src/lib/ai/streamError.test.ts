import { describe, it, expect } from "vitest";
import { STREAM_ERROR_SENTINEL, splitStreamError } from "./streamError";

describe("splitStreamError", () => {
  it("passes ordinary prose through untouched", () => {
    expect(splitStreamError("The lamp room is cold.")).toEqual({ text: "The lamp room is cold." });
  });

  it("keeps what the model wrote before the failure", () => {
    const raw = `Half an answer${STREAM_ERROR_SENTINEL}{"error":"The model could not be reached."}`;
    expect(splitStreamError(raw)).toEqual({
      text: "Half an answer",
      error: "The model could not be reached.",
    });
  });

  it("treats a truncated frame as a failure, not as prose", () => {
    const raw = `Half an answer${STREAM_ERROR_SENTINEL}{"error":"The model`;
    const { text, error } = splitStreamError(raw);
    expect(text).toBe("Half an answer");
    expect(error).toBeTruthy();
  });

  it("never leaves the sentinel in text the author sees", () => {
    const raw = `x${STREAM_ERROR_SENTINEL}{"error":"boom"}`;
    expect(splitStreamError(raw).text).not.toContain(STREAM_ERROR_SENTINEL);
  });

  it("survives an empty stream that failed immediately", () => {
    expect(splitStreamError(`${STREAM_ERROR_SENTINEL}{"error":"boom"}`)).toEqual({
      text: "",
      error: "boom",
    });
  });
});
