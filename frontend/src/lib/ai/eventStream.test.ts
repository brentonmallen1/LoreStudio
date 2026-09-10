import { describe, it, expect } from "vitest";
import { parseFrames, readEventStream, streamAnswer } from "./eventStream";

function frame(event: string, data: unknown = {}): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** A response whose body arrives in exactly these pieces. */
function responseOf(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length ? { done: false, value: encoder.encode(chunks[i++]) } : { done: true },
      }),
    },
  } as unknown as Response;
}

describe("parseFrames", () => {
  it("keeps a partial frame back instead of parsing half of it", () => {
    const { frames, rest } = parseFrames(`${frame("token", { delta: "a" })}event: token\ndata: {"del`);
    expect(frames).toEqual([{ event: "token", data: { delta: "a" } }]);
    expect(rest).toBe(`event: token\ndata: {"del`);
  });

  it("ignores a frame it cannot parse rather than rendering it", () => {
    const { frames } = parseFrames("event: token\ndata: {oops}\n\n");
    expect(frames).toEqual([]);
  });
});

describe("readEventStream", () => {
  it("assembles the answer from token events", async () => {
    const res = responseOf([
      frame("token", { delta: "The lamp " }),
      frame("token", { delta: "is out." }),
      frame("done"),
    ]);
    const result = await readEventStream(res);
    expect(result.text).toBe("The lamp is out.");
    expect(result.error).toBeNull();
  });

  it("survives a frame split across chunk boundaries", async () => {
    const whole = frame("token", { delta: "steady" }) + frame("done");
    const res = responseOf(whole.match(/.{1,3}/gs) ?? []);
    expect((await readEventStream(res)).text).toBe("steady");
  });

  it("keeps reasoning out of the answer", async () => {
    const res = responseOf([
      frame("thinking", { delta: "weighing it" }),
      frame("token", { delta: "Yes." }),
      frame("done"),
    ]);
    const result = await readEventStream(res);
    expect(result.text).toBe("Yes.");
    expect(result.thinking).toBe("weighing it");
  });

  it("reports a failure as an error, not as something the model said", async () => {
    const seen: string[] = [];
    const res = responseOf([
      frame("token", { delta: "As far as this" }),
      frame("error", { message: "The model could not be reached.", where: "scene-chat" }),
      frame("done"),
    ]);
    const result = await readEventStream(res, { onError: (m) => seen.push(m) });
    expect(result.text).toBe("As far as this");
    expect(result.error).toBe("The model could not be reached.");
    expect(seen).toEqual(["The model could not be reached."]);
  });

  it("passes usage through when the call reported it", async () => {
    const res = responseOf([
      frame("usage", { prompt_tokens: 1204, eval_tokens: 380, model: "gemma4" }),
      frame("done"),
    ]);
    expect((await readEventStream(res)).usage).toEqual({
      prompt_tokens: 1204,
      eval_tokens: 380,
      model: "gemma4",
    });
  });

  it("ignores an event it does not know", async () => {
    const res = responseOf([
      frame("tool_call", { name: "later" }),
      frame("token", { delta: "ok" }),
      frame("done"),
    ]);
    const result = await readEventStream(res);
    expect(result.text).toBe("ok");
    expect(result.error).toBeNull();
  });

  it("reads a final frame that arrived without its blank line", async () => {
    const res = responseOf([`event: token\ndata: {"delta":"tail"}`]);
    expect((await readEventStream(res)).text).toBe("tail");
  });

  it("reports a body-less response rather than hanging", async () => {
    const result = await readEventStream({ body: null } as unknown as Response);
    expect(result.error).toBeTruthy();
  });
});

describe("streamAnswer", () => {
  it("reports the answer so far as it grows", async () => {
    const seen: string[] = [];
    const res = responseOf([frame("token", { delta: "a" }), frame("token", { delta: "b" }), frame("done")]);
    const result = await streamAnswer(res, (text) => seen.push(text));
    expect(seen).toEqual(["a", "ab"]);
    expect(result.text).toBe("ab");
  });
});
