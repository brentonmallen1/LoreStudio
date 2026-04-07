import { useState, useRef, useEffect } from "react";
import type { AISession } from "../stores/aiStore";
import type { LLMParams } from "../types";
import { useLLMTransparency } from "./useLLMTransparency";
import { api } from "../api/client";

const CTX_LIMIT_FALLBACK = 128_000;

// Module-level cache so we only fetch once per session.
let _cachedCtxLimit: number | null = null;
let _fetchingCtxLimit = false;

export function useAIModeState(session: AISession) {
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
    api.ollamaModelInfo()
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

  const estimatedTokens = Math.round(
    session.messages.reduce((sum, m) => sum + m.content.length, 0) / 4
  );
  const ctxPct = Math.min(Math.round((estimatedTokens / ctxLimit) * 100), 100);
  const ctxWarning: "normal" | "approaching" | "exceeded" =
    ctxPct >= 80 ? "exceeded" : ctxPct >= 60 ? "approaching" : "normal";

  const tokenTooltip = `~${estimatedTokens.toLocaleString()} / ${ctxLimit.toLocaleString()} tokens estimated`;

  return {
    input, setInput,
    sessionParams, setSessionParams,
    showSettings, setShowSettings,
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
