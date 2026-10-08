import { http, HttpResponse } from "msw";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const authHandlers = [
  http.get("/api/auth/me", () => {
    return HttpResponse.json({
      id: "user-test-1",
      username: "testuser",
      display_name: "Test User",
      is_admin: false,
      settings: {},
    });
  }),

  http.post("/api/auth/login", () => {
    return HttpResponse.json({ access_token: "mock-token-12345" });
  }),
];

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

/** One typed event frame, as the server's SSE streams send them. */
const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/** A typed event stream: the text as token deltas a character at a time, then done. */
function eventStream(text: string): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const char of text) controller.enqueue(encoder.encode(frame("token", { delta: char })));
      controller.enqueue(encoder.encode(frame("done", {})));
      controller.close();
    },
  });
}

export const summarizeHandlers = [
  http.post("/api/stories/:storyId/summarize", () => {
    return new HttpResponse(eventStream("Story summary: a tale of resilience."), {
      headers: { "Content-Type": "text/event-stream" },
    });
  }),
];

// ---------------------------------------------------------------------------
// Default export — all handlers combined
// ---------------------------------------------------------------------------
export const handlers = [...authHandlers, ...summarizeHandlers];
