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
// Streaming helpers
// ---------------------------------------------------------------------------

/** Create a ReadableStream that emits text character by character. */
function textStream(text: string): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const char of text) {
        controller.enqueue(encoder.encode(char));
      }
      controller.close();
    },
  });
}

// ---------------------------------------------------------------------------
// Interview endpoints
// ---------------------------------------------------------------------------
export const interviewHandlers = [
  http.post("/api/interviews/characters/:characterId", () => {
    return HttpResponse.json({
      id: "interview-1",
      character_id: "char-1",
      title: "Test Interview",
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }),

  http.get("/api/interviews/:interviewId", () => {
    return HttpResponse.json({
      id: "interview-1",
      character_id: "char-1",
      title: "Test Interview",
      messages: [],
    });
  }),

  http.post("/api/interviews/:interviewId/messages", () => {
    return new HttpResponse(
      textStream("I understand your question. Let me think about that carefully."),
      { headers: { "Content-Type": "text/plain" } }
    );
  }),

  http.post("/api/interviews/:interviewId/summarize", () => {
    return new HttpResponse(
      textStream("Character summary: thoughtful and reserved."),
      { headers: { "Content-Type": "text/plain" } }
    );
  }),
];

// ---------------------------------------------------------------------------
// Dialogue endpoints
// ---------------------------------------------------------------------------
export const dialogueHandlers = [
  http.post("/api/scenes/:sceneId/dialogue/ai-suggest", () => {
    return HttpResponse.json([
      {
        id: "proposal-1",
        quote_content: "Hello there",
        inferred_speaker: "Maya",
        character_id: "char-1",
        confidence: 0.85,
        source_excerpt: '..."Hello there," she said...',
      },
    ]);
  }),

  http.post("/api/scenes/:sceneId/dialogue/suggest-tags", () => {
    return HttpResponse.json([]);
  }),
];

// ---------------------------------------------------------------------------
// Analysis endpoints
// ---------------------------------------------------------------------------
export const analysisHandlers = [
  http.post("/api/stories/:storyId/analyze/economy", () => {
    return HttpResponse.json({
      success: true,
      data: {
        thread_balance: { summary: "Balanced", details: [] },
        scene_economy: { summary: "Efficient", details: [] },
        try_fail_cycles: { summary: "Present", details: [] },
        recommendations: [],
      },
    });
  }),

  http.post("/api/stories/:storyId/summarize", () => {
    return new HttpResponse(
      textStream("Story summary: a tale of resilience."),
      { headers: { "Content-Type": "text/plain" } }
    );
  }),
];

// ---------------------------------------------------------------------------
// Ollama / LLM status
// ---------------------------------------------------------------------------
export const ollamaHandlers = [
  http.get("/api/ollama/status", () => {
    return HttpResponse.json({ available: true, model: "gemma4", context_length: 128000 });
  }),
];

// ---------------------------------------------------------------------------
// Default export — all handlers combined
// ---------------------------------------------------------------------------
export const handlers = [
  ...authHandlers,
  ...interviewHandlers,
  ...dialogueHandlers,
  ...analysisHandlers,
  ...ollamaHandlers,
];
