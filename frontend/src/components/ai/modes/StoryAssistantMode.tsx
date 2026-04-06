import { useState, useRef } from "react";
import { BookOpen, Settings2, Database } from "lucide-react";

const CTX_LIMIT = 128_000;
import { useAIStore } from "../../../stores/aiStore";
import { useStoryStore } from "../../../stores/storyStore";
import type { AISession } from "../../../stores/aiStore";
import type { LLMParams } from "../../../types";
import { useLLMTransparency } from "../../../hooks/useLLMTransparency";
import { useLLMContextSources } from "../../../hooks/useLLMContextSources";
import { LLMTransparencyModal, LLMTransparencyTrigger, LLMContextSources, ChatSettingsModal } from "../../llm";
import MessageList from "../shared/MessageList";
import ChatInput from "../shared/ChatInput";
import styles from "./StoryAssistantMode.module.css";

const STARTER_PROMPTS = [
  "What themes are emerging in this story?",
  "Are there any plot holes or inconsistencies?",
  "How is the protagonist's arc developing?",
  "What are the unresolved conflicts I need to address?",
];

interface Props {
  session: AISession;
}

export default function StoryAssistantMode({ session }: Props) {
  const { sendMessage, updateSessionContext } = useAIStore();
  const { stories } = useStoryStore();
  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [sessionParams, setSessionParams] = useState<LLMParams | undefined>();

  const lastUserMsg = useRef("");
  const lastResponse = useRef("");
  const transparency = useLLMTransparency();

  const storyId = session.context.storyId ?? "";

  const estimatedTokens = Math.round(session.messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
  const ctxPct = Math.min(Math.round((estimatedTokens / CTX_LIMIT) * 100), 100);
  const ctxWarning = ctxPct >= 80 ? "exceeded" : ctxPct >= 60 ? "approaching" : "normal";

  const { sources: contextSources } = useLLMContextSources(
    storyId ? { context_type: "scene-chat", story_id: storyId, node_id: "__story__" } : null
  );

  function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || session.isStreaming) return;
    lastUserMsg.current = content;
    sendMessage(session.id, content, undefined, sessionParams);
    setInput("");
  }

  return (
    <>
      <LLMTransparencyModal isOpen={transparency.isOpen} onClose={transparency.close} data={transparency.data} />
      <ChatSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onApply={setSessionParams}
        sessionParams={sessionParams}
      />

      {/* Sub-header */}
      <div className={styles.subHeader}>
        <BookOpen size={14} className={styles.headerIcon} />
        <span className={styles.title}>Story Assistant</span>

        {!session.contextLocked ? (
          <select
            className={styles.storySelect}
            value={storyId}
            onChange={(e) => updateSessionContext(session.id, { storyId: e.target.value || undefined })}
          >
            <option value="">— pick a story —</option>
            {stories.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        ) : (
          <span className={styles.storyLabel} title={session.resolvedNames.storyTitle}>
            {session.resolvedNames.storyTitle ?? "Story"}
          </span>
        )}

        {session.messages.length > 0 && (
          <div
            className={styles.ctxBadge}
            data-warning={ctxWarning}
            title={`~${estimatedTokens.toLocaleString()} / ${CTX_LIMIT.toLocaleString()} tokens`}
          >
            <Database size={10} />
            {ctxPct}%
          </div>
        )}
        <LLMTransparencyTrigger
          disabled={!transparency.hasData}
          onClick={() => transparency.open(
            { context_type: "scene-chat", story_id: storyId, node_id: "__story__", user_message: lastUserMsg.current },
            lastResponse.current,
          )}
        />
        <button
          className={`${styles.headerBtn} ${sessionParams ? styles.headerBtnActive : ""}`}
          onClick={() => setShowSettings(true)}
          title="AI parameters"
        >
          <Settings2 size={13} />
        </button>
      </div>

      <LLMContextSources sources={contextSources} />

      {session.messages.length === 0 && !session.isStreaming ? (
        <div className={styles.empty}>
          <BookOpen size={22} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Story Assistant</p>
          <p className={styles.emptyHint}>
            Ask about your story — themes, arcs, plot holes, character motivations, or what comes next.
          </p>
          <div className={styles.starters}>
            {STARTER_PROMPTS.map((p) => (
              <button key={p} className={styles.starterBtn} onClick={() => handleSend(p)} disabled={session.isStreaming}>
                {p}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <MessageList
          messages={session.messages}
          streamingText={session.streamingText}
          isStreaming={session.isStreaming}
        />
      )}

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={() => handleSend()}
        disabled={session.isStreaming}
        placeholder="Ask about your story…"
      />
    </>
  );
}
