import type { ChatMessage, ContextOptions, LLMParams } from "../types";
import { toWire, type MentionedRef } from "../types/mentions";
import { BASE, getToken } from "./request";

/**
 * The streaming chat calls (moved out of client.ts, which is at its size lock). Every one
 * carries `mentioned_refs` (doc 11 P6): what the author @-mentioned in the composer, added
 * to the context the server assembles on its own.
 */
function post(path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const token = getToken();
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal,
  });
}

export const aiChatApi = {
  sendChatMessage: (
    storyId: string,
    nodeId: string,
    messages: ChatMessage[],
    signal?: AbortSignal,
    llmParams?: LLMParams,
    mode?: string,
    contextOptions?: ContextOptions,
    chronicleSessionId?: string,
    mentionedRefs?: MentionedRef[],
  ) =>
    post(
      `/stories/${storyId}/chat`,
      {
        node_id: nodeId,
        messages,
        llm_params: llmParams ?? null,
        mode: mode ?? null,
        context_options: contextOptions ?? null,
        chronicle_session_id: chronicleSessionId ?? null,
        mentioned_refs: toWire(mentionedRefs),
      },
      signal,
    ),

  sendInterviewMessage: (
    interviewId: string,
    content: string,
    signal?: AbortSignal,
    llmParams?: LLMParams,
    mentionedRefs?: MentionedRef[],
  ) =>
    post(
      `/interviews/${interviewId}/messages`,
      { content, llm_params: llmParams ?? null, mentioned_refs: toWire(mentionedRefs) },
      signal,
    ),

  sendPanelMessage: (
    panelId: string,
    content: string,
    signal?: AbortSignal,
    llmParams?: LLMParams,
    responseLength?: "brief" | "normal" | "detailed",
    mentionedRefs?: MentionedRef[],
  ) =>
    post(
      `/panels/${panelId}/messages`,
      {
        content,
        llm_params: llmParams ?? null,
        response_length: responseLength ?? null,
        mentioned_refs: toWire(mentionedRefs),
      },
      signal,
    ),

  sendWhatIfMessage: (
    storyId: string,
    messages: ChatMessage[],
    signal?: AbortSignal,
    llmParams?: LLMParams,
    mentionedRefs?: MentionedRef[],
  ) =>
    post(
      `/stories/${storyId}/whatif`,
      { messages, llm_params: llmParams ?? null, mentioned_refs: toWire(mentionedRefs) },
      signal,
    ),

  sendClicheCoachMessage: (
    storyId: string,
    nodeId: string,
    messages: ChatMessage[],
    selectedText?: string,
    signal?: AbortSignal,
    llmParams?: LLMParams,
    mentionedRefs?: MentionedRef[],
  ) =>
    post(
      `/stories/${storyId}/chat/cliche-coach`,
      {
        node_id: nodeId,
        messages,
        selected_text: selectedText ?? null,
        llm_params: llmParams ?? null,
        mentioned_refs: toWire(mentionedRefs),
      },
      signal,
    ),

  sendIdentityWorkshopMessage: (
    storyId: string,
    messages: ChatMessage[],
    signal?: AbortSignal,
    llmParams?: LLMParams,
    mentionedRefs?: MentionedRef[],
  ) =>
    post(
      `/stories/${storyId}/identity-workshop`,
      { messages, llm_params: llmParams ?? null, mentioned_refs: toWire(mentionedRefs) },
      signal,
    ),

  sendBookDescriptionMessage: (
    storyId: string,
    messages: ChatMessage[],
    signal?: AbortSignal,
    llmParams?: LLMParams,
    mentionedRefs?: MentionedRef[],
  ) =>
    post(
      `/stories/${storyId}/chat/book-description`,
      { messages, llm_params: llmParams ?? null, mentioned_refs: toWire(mentionedRefs) },
      signal,
    ),

  sendQueryLetterMessage: (
    storyId: string,
    messages: ChatMessage[],
    signal?: AbortSignal,
    llmParams?: LLMParams,
    mentionedRefs?: MentionedRef[],
  ) =>
    post(
      `/stories/${storyId}/chat/query-letter`,
      { messages, llm_params: llmParams ?? null, mentioned_refs: toWire(mentionedRefs) },
      signal,
    ),
};
