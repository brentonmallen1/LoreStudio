import { useState } from "react";
import { Feather } from "lucide-react";
import { useAIStore } from "../../../stores/aiStore";
import type { AISession } from "../../../stores/aiStore";
import { useAIModeState } from "../../../hooks/useAIModeState";
import AIModeWrapper from "../AIModeWrapper";
import ChatImagePicker from "../../layout/ChatImagePicker";
import MessageList from "../shared/MessageList";
import ChatInput from "../shared/ChatInput";
import ContextChips from "../ContextChips";
import styles from "./AssistantMode.module.css";

interface SelectedImage {
  base64: string;
  mimeType: string;
  filename: string;
  assetId?: string;
}

const STARTER_PROMPTS = [
  "What are the major themes in my story?",
  "Which character has the most unresolved arc?",
  "Where do the narrative threads feel weak?",
  "What's the emotional journey of this story?",
];

interface Props {
  session: AISession;
}

export default function AssistantMode({ session }: Props) {
  const state = useAIModeState(session);
  const { sendMessage, cancelStreaming } = useAIStore();
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);

  const storyId = session.context.storyId ?? "";
  const nodeId = session.context.nodeId ?? "";

  function handleSend(text?: string) {
    const content = (text ?? state.input).trim();
    if (!content || session.isStreaming) return;
    state.lastUserMsg.current = content;
    const images = selectedImage ? [selectedImage.base64] : undefined;
    sendMessage(session.id, content, images, state.sessionParams);
    state.setInput("");
    setSelectedImage(null);
  }

  return (
    <AIModeWrapper
      session={session}
      state={state}
      icon={Feather}
      title="Assistant"
      onTransparencyClick={() => state.transparency.open(
        { context_type: "scene-chat", story_id: storyId, node_id: nodeId, user_message: state.lastUserMsg.current },
        state.lastResponse.current,
      )}
    >
      {/* Context chips — always editable */}
      <ContextChips
        sessionId={session.id}
        context={session.context}
        resolvedNames={session.resolvedNames}
      />

      {session.messages.length === 0 && !session.isStreaming ? (
        <div className={styles.empty}>
          <Feather size={22} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>AI Assistant</p>
          <p className={styles.emptyHint}>
            {storyId
              ? "Ask anything about your story — themes, characters, narrative arcs, or what to write next."
              : "Add a story to context above, then ask anything."}
          </p>
          {storyId && (
            <div className={styles.starters}>
              {STARTER_PROMPTS.map((p) => (
                <button key={p} className={styles.starterBtn} onClick={() => handleSend(p)} disabled={session.isStreaming}>
                  {p}
                </button>
              ))}
            </div>
          )}
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
        disabled={session.isStreaming || !storyId}
        placeholder={storyId ? "Ask anything…" : "Add a story context to start…"}
        hintLeft={
          storyId ? (
            <ChatImagePicker
              storyId={storyId}
              selected={selectedImage}
              onSelect={setSelectedImage}
              disabled={session.isStreaming}
            />
          ) : undefined
        }
      />
    </AIModeWrapper>
  );
}
