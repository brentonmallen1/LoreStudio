import { useState, useRef } from "react";
import type { AISession } from "../stores/aiStore";
import type { LLMParams } from "../types";
import { useLLMTransparency } from "./useLLMTransparency";

const CTX_LIMIT = 128_000;

export function useAIModeState(session: AISession) {
  const [input, setInput] = useState("");
  const [sessionParams, setSessionParams] = useState<LLMParams | undefined>();
  const [showSettings, setShowSettings] = useState(false);
  const lastUserMsg = useRef("");
  const lastResponse = useRef("");
  const transparency = useLLMTransparency();

  const estimatedTokens = Math.round(
    session.messages.reduce((sum, m) => sum + m.content.length, 0) / 4
  );
  const ctxPct = Math.min(Math.round((estimatedTokens / CTX_LIMIT) * 100), 100);
  const ctxWarning: "normal" | "approaching" | "exceeded" =
    ctxPct >= 80 ? "exceeded" : ctxPct >= 60 ? "approaching" : "normal";

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
    CTX_LIMIT,
  };
}
