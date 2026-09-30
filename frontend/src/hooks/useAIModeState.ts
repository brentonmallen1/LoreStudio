import { useState, useRef, useEffect, useMemo } from "react";
import type { AISession } from "../stores/aiStore";
import type { LLMParams, PromptPreviewRequest, TokenBreakdown } from "../types";
import { toWire } from "../types/mentions";
import type { CallLookup } from "../api/aiCalls";
import { useLLMTransparency } from "./useLLMTransparency";
import { api } from "../api/client";
import { contextWindowFor } from "../lib/ai/contextWindow";
import { getSessionType } from "../lib/ai/sessionTypes";

const CTX_LIMIT_FALLBACK = 128_000;

// Module-level cache so we only fetch once per session.
let _cachedCtxLimit: number | null = null;
let _fetchingCtxLimit = false;

export function useAIModeState(session: AISession, contextBreakdown?: TokenBreakdown | null) {
  const [input, setInput] = useState("");
  const [sessionParams, setSessionParams] = useState<LLMParams | undefined>();
  const [showSettings, setShowSettings] = useState(false);
  const [ctxLimit, setCtxLimit] = useState(_cachedCtxLimit ?? CTX_LIMIT_FALLBACK);
  const lastUserMsg = useRef("");
  const lastResponse = useRef("");
  const rawTransparency = useLLMTransparency();
  // Every preview a mode opens carries what the author @mentioned, so what is inspected
  // is what was sent (doc 11 P6) without each mode remembering to add it.
  const mentionedRefs = session.mentionedRefs;
  const transparency = useMemo(
    () => ({
      ...rawTransparency,
      open: (request: PromptPreviewRequest, response: string, call?: CallLookup) =>
        rawTransparency.open({ mentioned_refs: toWire(mentionedRefs), ...request }, response, call),
    }),
    [rawTransparency, mentionedRefs],
  );

  // Fetch model context length once on first use
  useEffect(() => {
    if (_cachedCtxLimit !== null) {
      setCtxLimit(_cachedCtxLimit);
      return;
    }
    if (_fetchingCtxLimit) return;
    _fetchingCtxLimit = true;
    api
      .ollamaModelInfo()
      .then((info) => {
        const limit = info.context_length ?? CTX_LIMIT_FALLBACK;
        _cachedCtxLimit = limit;
        setCtxLimit(limit);
      })
      .catch(() => {
        _cachedCtxLimit = CTX_LIMIT_FALLBACK;
      })
      .finally(() => {
        _fetchingCtxLimit = false;
      });
  }, []);

  /**
   * Keep a reply as reference material (doc 06 §2.1). The Compendium is where research
   * and notes live; an AI answer worth keeping is that, not manuscript.
   */
  async function saveToNotes(content: string): Promise<void> {
    const storyId = session.context.storyId;
    if (!storyId) return;
    const title = `${getSessionType(session.type)?.label ?? "AI"} — ${new Date().toLocaleDateString()}`;
    await api.createCompendiumNote(storyId, { title, content, category: "AI note" });
  }

  // How a result on screen finds the call behind it (doc 06 §3).
  const callLookup = {
    feature: getSessionType(session.type)?.backendFeatureId ?? "",
    story_id: session.context.storyId,
    node_id: session.context.nodeId,
    character_id: session.context.characterId,
    session_id: session.backendSessionId,
  };

  // Measure against the window the call will actually get, not the model maximum.
  const window = contextWindowFor(session.type, ctxLimit);

  const historyTokens = Math.round(session.messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
  const systemTokens = contextBreakdown?.system_prompt ?? 0;
  const contextTokens = contextBreakdown?.context ?? 0;
  const estimatedTokens = historyTokens + systemTokens + contextTokens;
  const ctxPct = Math.min(Math.round((estimatedTokens / window) * 100), 100);
  const ctxWarning: "normal" | "approaching" | "exceeded" | "critical" =
    ctxPct >= 95 ? "critical" : ctxPct >= 80 ? "exceeded" : ctxPct >= 60 ? "approaching" : "normal";

  const tokenTooltip = contextBreakdown
    ? [
        `System:  ~${systemTokens.toLocaleString()}`,
        `Context: ~${contextTokens.toLocaleString()}`,
        `History: ~${historyTokens.toLocaleString()}`,
        `─────────────────────`,
        `Total:   ~${estimatedTokens.toLocaleString()} / ${window.toLocaleString()}`,
      ].join("\n")
    : `~${historyTokens.toLocaleString()} / ${window.toLocaleString()} tokens (history only)`;

  return {
    saveToNotes,
    callLookup,
    input,
    setInput,
    sessionParams,
    setSessionParams,
    showSettings,
    setShowSettings,
    lastUserMsg,
    lastResponse,
    transparency,
    estimatedTokens,
    ctxPct,
    ctxWarning,
    CTX_LIMIT: ctxLimit,
    tokenTooltip,
  };
}
