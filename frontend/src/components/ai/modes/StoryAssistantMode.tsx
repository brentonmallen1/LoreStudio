import { BookOpen, RotateCcw } from "lucide-react";
import { useAIStore } from "../../../stores/aiStore";
import { useStoryStore } from "../../../stores/storyStore";
import type { AISession } from "../../../stores/aiStore";
import { useAIModeState } from "../../../hooks/useAIModeState";
import { useLLMContextSources } from "../../../hooks/useLLMContextSources";
import { LLMContextSources } from "../../llm";
import AIModeWrapper from "../AIModeWrapper";
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
  const { sendMessage, updateSessionContext, continuePendingResume, discardPendingResume, cancelStreaming } = useAIStore();
  const { stories } = useStoryStore();

  const storyId = session.context.storyId ?? "";

  const { sources: contextSources, tokenBreakdown } = useLLMContextSources(
    storyId ? { context_type: "scene-chat", story_id: storyId, node_id: "__story__" } : null
  );
  const state = useAIModeState(session, tokenBreakdown);

  function handleSend(text?: string) {
    const content = (text ?? state.input).trim();
    if (!content || session.isStreaming) return;
    state.lastUserMsg.current = content;
    sendMessage(session.id, content, undefined, state.sessionParams);
    state.setInput("");
  }

  return (
    <AIModeWrapper
      session={session}
      state={state}
      icon={BookOpen}
      title="Story Assistant"
      onTransparencyClick={() => state.transparency.open(
        { context_type: "scene-chat", story_id: storyId, node_id: "__story__", user_message: state.lastUserMsg.current },
        state.lastResponse.current,
      )}
      headerExtra={
        !session.contextLocked ? (
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
        )
      }
    >
      <LLMContextSources sources={contextSources} />

      {session.pendingResume ? (
        <div className={styles.resumePrompt}>
          <RotateCcw size={20} className={styles.resumeIcon} />
          <p className={styles.resumeTitle}>Continue previous conversation?</p>
          <p className={styles.resumePreview}>"{session.pendingResume.preview}"</p>
          <p className={styles.resumeMeta}>{session.pendingResume.messageCount} messages</p>
          <div className={styles.resumeActions}>
            <button className={styles.resumeContinueBtn} onClick={() => continuePendingResume(session.id)}>
              Continue
            </button>
            <button className={styles.resumeFreshBtn} onClick={() => discardPendingResume(session.id)}>
              Start Fresh
            </button>
          </div>
        </div>
      ) : session.messages.length === 0 && !session.isStreaming ? (
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
        value={state.input}
        onChange={state.setInput}
        onSend={() => handleSend()}
        onCancel={() => cancelStreaming(session.id)}
        disabled={session.isStreaming}
        placeholder="Ask about your story…"
      />
    </AIModeWrapper>
  );
}
