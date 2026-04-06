import { useState, useRef } from "react";
import { Sparkles, Settings2, ChevronDown, ChevronUp, Database } from "lucide-react";
import { api } from "../../../api/client";
import { useAIStore } from "../../../stores/aiStore";
import { useStoryStore } from "../../../stores/storyStore";
import type { AISession } from "../../../stores/aiStore";
import type { LLMParams, ChatContextPreview } from "../../../types";
import { useLLMTransparency } from "../../../hooks/useLLMTransparency";
import { useLLMContextSources } from "../../../hooks/useLLMContextSources";
import { LLMTransparencyModal, LLMTransparencyTrigger, LLMContextSources, ChatSettingsModal } from "../../llm";
import ChatImagePicker from "../../layout/ChatImagePicker";
import MessageList from "../shared/MessageList";
import ChatInput from "../shared/ChatInput";
import styles from "./SceneAssistantMode.module.css";

const CTX_LIMIT = 128_000;

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
  const { sendMessage, updateSessionContext } = useAIStore();
  const { structure } = useStoryStore();
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionParams, setSessionParams] = useState<LLMParams | undefined>();
  const [showCtx, setShowCtx] = useState(false);
  const [ctx, setCtx] = useState<ChatContextPreview | null>(null);

  const lastUserMsg = useRef("");
  const lastResponse = useRef("");
  const transparency = useLLMTransparency();

  const storyId = session.context.storyId ?? "";
  const nodeId = session.context.nodeId ?? "";

  const estimatedTokens = Math.round(session.messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
  const ctxPct = Math.min(Math.round((estimatedTokens / CTX_LIMIT) * 100), 100);
  const ctxWarning = ctxPct >= 80 ? "exceeded" : ctxPct >= 60 ? "approaching" : "normal";
  const flatNodes = flattenNodes(structure);

  const { sources: contextSources } = useLLMContextSources(
    storyId && nodeId ? { context_type: "scene-chat", story_id: storyId, node_id: nodeId } : null
  );

  function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || session.isStreaming) return;
    lastUserMsg.current = content;
    const images = selectedImage ? [selectedImage.base64] : undefined;
    sendMessage(session.id, content, images, sessionParams);
    setInput("");
    setSelectedImage(null);
  }

  function handleContextToggle() {
    if (!showCtx && !ctx && storyId && nodeId) {
      api.getChatContext(storyId, nodeId).then(setCtx).catch(() => {});
    }
    setShowCtx((v) => !v);
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
        <Sparkles size={14} className={styles.headerIcon} />
        <span className={styles.title}>Scene Assistant</span>

        {/* Scene picker (unlocked) or label (locked) */}
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
            { context_type: "scene-chat", story_id: storyId, node_id: nodeId, user_message: lastUserMsg.current },
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

      {/* Context preview */}
      {showCtx && ctx && (
        <div className={styles.ctxPreview}>
          <p className={styles.ctxTitle}><strong>{ctx.story.title}</strong></p>
          {ctx.scene?.synopsis && <p className={styles.ctxNote}>{ctx.scene.synopsis}</p>}
          {ctx.characters_in_scene?.length > 0 && (
            <p className={styles.ctxNote}>Characters: {ctx.characters_in_scene.map(c => c.name).join(", ")}</p>
          )}
        </div>
      )}

      {/* Messages / empty state */}
      {session.messages.length === 0 && !session.isStreaming ? (
        <div className={styles.empty}>
          <Sparkles size={22} className={styles.emptyIcon} />
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
        value={input}
        onChange={setInput}
        onSend={() => handleSend()}
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
    </>
  );
}

