import { request } from "../../api/request";

/**
 * Reading the typed LLM stream.
 *
 * The server used to send raw text, which meant two things arrived disguised as prose:
 * failures, appended after the transport had already committed to 200, and Gemma's
 * reasoning, wrapped in sentinels that every consumer regexed out for itself. Both now
 * have an event, so what reaches a component is only what the author should read.
 */

export interface StreamUsage {
  prompt_tokens: number | null;
  eval_tokens: number | null;
  model: string;
}

export interface StreamResult {
  /** The answer. Never contains reasoning, and never contains an error message. */
  text: string;
  thinking: string;
  usage: StreamUsage | null;
  /** Set when the call failed. The answer, if any, is whatever arrived before that. */
  error: string | null;
}

export interface StreamHandlers {
  onToken?: (text: string, delta: string) => void;
  onThinking?: (thinking: string, delta: string) => void;
  onUsage?: (usage: StreamUsage) => void;
  onError?: (message: string) => void;
  /** Checked before each read. Return true to stop consuming and release the stream. */
  stop?: () => boolean;
}

export interface SSEFrame {
  event: string;
  data: Record<string, unknown>;
}

/**
 * Pull whole frames out of a buffer, returning the remainder.
 *
 * A frame ends at a blank line, and a chunk boundary lands wherever the network puts it,
 * so a partial frame has to be kept rather than parsed.
 */
export function parseFrames(buffer: string): { frames: SSEFrame[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const frames: SSEFrame[] = [];

  for (const part of parts) {
    let event = "";
    const data: string[] = [];
    for (const line of part.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7);
      else if (line.startsWith("data: ")) data.push(line.slice(6));
    }
    if (!event) continue;
    try {
      frames.push({ event, data: data.length ? JSON.parse(data.join("\n")) : {} });
    } catch {
      // A frame we cannot parse is a frame we cannot act on. Dropping it is better than
      // rendering half of it.
    }
  }
  return { frames, rest };
}

function deltaOf(frame: SSEFrame): string {
  return typeof frame.data.delta === "string" ? frame.data.delta : "";
}

/** Consume a typed stream to the end. Never throws on a model failure — see `error`. */
/**
 * A summary or a reply whose result is kept runs to the end on the server even when its
 * window closes (doc 21 R7). The server cannot tell Stop from a closed window, so Stop says so.
 */
function stopOnServer(res: Response) {
  const id = res.headers.get("X-Stream-Id");
  if (id) void request(`/streams/${id}/stop`, { method: "POST" }).catch(() => undefined);
}

export async function readEventStream(res: Response, handlers: StreamHandlers = {}): Promise<StreamResult> {
  const result: StreamResult = { text: "", thinking: "", usage: null, error: null };
  if (!res.body) {
    result.error = "The server sent no response.";
    handlers.onError?.(result.error);
    return result;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const apply = (frame: SSEFrame) => {
    switch (frame.event) {
      case "token": {
        const delta = deltaOf(frame);
        result.text += delta;
        handlers.onToken?.(result.text, delta);
        break;
      }
      case "thinking": {
        const delta = deltaOf(frame);
        result.thinking += delta;
        handlers.onThinking?.(result.thinking, delta);
        break;
      }
      case "usage":
        result.usage = frame.data as unknown as StreamUsage;
        handlers.onUsage?.(result.usage);
        break;
      case "error":
        result.error = typeof frame.data.message === "string" ? frame.data.message : "Something went wrong.";
        handlers.onError?.(result.error);
        break;
      default:
        // `done`, and anything added later. Unknown events are ignored so a new one on
        // the server does not need a client change to be safe.
        break;
    }
  };

  for (;;) {
    if (handlers.stop?.()) {
      stopOnServer(res);
      await reader.cancel();
      return result;
    }
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (e) {
      // Aborted: the author pressed Stop. A stream whose result is kept would otherwise carry on.
      if (e instanceof Error && e.name === "AbortError") stopOnServer(res);
      throw e;
    }
    const { done, value } = chunk;
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { frames, rest } = parseFrames(buffer);
    buffer = rest;
    frames.forEach(apply);
  }
  parseFrames(buffer + "\n\n").frames.forEach(apply);

  return result;
}

/**
 * Hand every frame to a callback.
 *
 * For streams that carry more than one voice — the panel, where each event names the
 * character it belongs to — and so cannot be reduced to a single answer.
 */
export async function readFrames(
  res: Response,
  onFrame: (frame: SSEFrame) => void | Promise<void>,
): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { frames, rest } = parseFrames(buffer);
    buffer = rest;
    for (const frame of frames) await onFrame(frame);
  }
  for (const frame of parseFrames(buffer + "\n\n").frames) await onFrame(frame);
}

/**
 * The common case: stream an answer, showing it as it arrives.
 *
 * `onText` receives the answer so far. An error is appended to the returned result rather
 * than to the text, so a caller that saves the answer never saves a failure as content.
 */
export async function streamAnswer(res: Response, onText?: (text: string) => void): Promise<StreamResult> {
  return readEventStream(res, { onToken: (text) => onText?.(text) });
}
