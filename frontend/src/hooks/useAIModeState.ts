import { useState, useRef, useEffect } from "react";
import type { AISession } from "../stores/aiStore";
import type { LLMParams, TokenBreakdown } from "../types";
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
  const transparency = useLLMTransparency();

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
