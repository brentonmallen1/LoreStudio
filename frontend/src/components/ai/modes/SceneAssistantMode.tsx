import { useState, useRef } from "react";
import { Feather, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { api } from "../../../api/client";
import { useAIStore } from "../../../stores/aiStore";
import { useStoryStore } from "../../../stores/storyStore";
import type { AISession } from "../../../stores/aiStore";
import type { ChatContextPreview } from "../../../types";
import { useAIModeState } from "../../../hooks/useAIModeState";
import { useLLMContextSources } from "../../../hooks/useLLMContextSources";
import { LLMContextSources } from "../../llm";
import AIModeWrapper from "../AIModeWrapper";
import ChatImagePicker from "../../layout/ChatImagePicker";
import MessageList from "../shared/MessageList";
import ChatInput from "../shared/ChatInput";
import styles from "./SceneAssistantMode.module.css";

interface SelectedImage {
  base64: string;
  mimeType: string;
  filename: string;
  assetId?: string;
}

const STARTER_PROMPTS = [
  "What's the narrative purpose of this scene?",
  "Are there any consistency issues I should watch for?",
  "What tension could I raise here?",
  "What should the reader feel leaving this scene?",
];

function flattenNodes(nodes: import("../../../types").StructureNode[], depth = 0): Array<{ id: string; label: string; depth: number }> {
  return nodes.flatMap((n) => [
    { id: n.id, label: n.title || "(untitled)", depth },
    ...flattenNodes(n.children ?? [], depth + 1),
  ]);
}

interface Props {
  session: AISession;
}

export default function SceneAssistantMode({ session }: Props) {
  const { sendMessage, updateSessionContext, continuePendingResume, discardPendingResume, cancelStreaming } = useAIStore();
  const { structure } = useStoryStore();
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [showCtx, setShowCtx] = useState(false);
  const [ctx, setCtx] = useState<ChatContextPreview | null>(null);

  const lastUserMsg = useRef("");

  const storyId = session.context.storyId ?? "";
  const nodeId = session.context.nodeId ?? "";
  const flatNodes = flattenNodes(structure);

  const contextOptions = session.context.contextOptions;
  const { sources: contextSources, tokenBreakdown } = useLLMContextSources(
    storyId && nodeId
      ? { context_type: "scene-chat", story_id: storyId, node_id: nodeId, context_options: contextOptions }
      : null
  );
  const state = useAIModeState(session, tokenBreakdown);

  function handleSend(text?: string) {
    const content = (text ?? state.input).trim();
    if (!content || session.isStreaming) return;
    lastUserMsg.current = content;
    state.lastUserMsg.current = content;
    const images = selectedImage ? [selectedImage.base64] : undefined;
    sendMessage(session.id, content, images, state.sessionParams);
    state.setInput("");
    setSelectedImage(null);
  }

  function handleContextToggle() {
    if (!showCtx && !ctx && storyId && nodeId) {
      api.getChatContext(storyId, nodeId).then(setCtx).catch(() => {});
    }
    setShowCtx((v) => !v);
  }

  return (
    <AIModeWrapper
      session={session}
      state={state}
      icon={Feather}
      title="Scene Assistant"
      showContextOptions
      onTransparencyClick={() => state.transparency.open(
        { context_type: "scene-chat", story_id: storyId, node_id: nodeId, user_message: state.lastUserMsg.current, context_options: contextOptions },
        state.lastResponse.current,
      )}
      headerExtra={
        <>
          {!session.contextLocked ? (
            <select
              className={styles.nodeSelect}
              value={nodeId}
              onChange={(e) => updateSessionContext(session.id, { nodeId: e.target.value || undefined })}
            >
              <option value="">— pick a scene —</option>
              {flatNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {"  ".repeat(n.depth)}{n.label}
                </option>
              ))}
            </select>
          ) : (
            <span className={styles.nodeLabel} title={session.resolvedNames.nodeName}>
              {session.resolvedNames.nodeName ?? "Scene"}
            </span>
          )}
          <button
            className={`${styles.headerBtn} ${showCtx ? styles.headerBtnActive : ""}`}
            onClick={handleContextToggle}
            title="Show context"
          >
            {showCtx ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </>
      }
      contextBar={
        <>
          <LLMContextSources sources={contextSources} />
          {showCtx && ctx && (
            <div className={styles.ctxPreview}>
              <p className={styles.ctxTitle}><strong>{ctx.story.title}</strong></p>
              {ctx.scene?.synopsis && <p className={styles.ctxNote}>{ctx.scene.synopsis}</p>}
              {ctx.characters_in_scene?.length > 0 && (
                <p className={styles.ctxNote}>Characters: {ctx.characters_in_scene.map(c => c.name).join(", ")}</p>
              )}
            </div>
          )}
        </>
      }
    >
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
          <Feather size={22} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Scene Assistant</p>
          <p className={styles.emptyHint}>Ask anything about this scene — consistency, character motivation, narrative purpose.</p>
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
        placeholder="Ask about this scene…"
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
