import { useState, useRef, useEffect } from "react";
import { X, Send, ChevronDown, ChevronUp, Sparkles, Bot, User2, Info, BookOpen, Settings2 } from "lucide-react";
import { api } from "../../api/client";
import { useUIStore } from "../../stores/uiStore";
import type { ChatMessage, ChatContextPreview, LLMParams } from "../../types";
import { useLLMTransparency } from "../../hooks/useLLMTransparency";
import { useLLMStream } from "../../hooks/useLLMStream";
import { useLLMContextSources } from "../../hooks/useLLMContextSources";
import { LLMTransparencyModal, LLMTransparencyTrigger, LLMContextSources, ChatSettingsModal } from "../llm";
import styles from "./SceneChatPanel.module.css";

interface Props {
  storyId: string;
  nodeId: string;
}

function ContextPreview({ ctx }: { ctx: ChatContextPreview }) {
  return (
    <div className={styles.contextBody}>
      <div className={styles.contextSection}>
        <strong>{ctx.story.title}</strong>
        {ctx.story.genre && <span className={styles.ctxTag}>{ctx.story.genre}</span>}
        {ctx.story.tone && <span className={styles.ctxTag}>{ctx.story.tone}</span>}
        {ctx.story.narrative_intent && (
          <p className={styles.ctxNote}>Intent: {ctx.story.narrative_intent}</p>
        )}
        {(ctx.story.unresolved_goals ?? []).length > 0 && (
          <p className={styles.ctxNote}>
            Goals: {(ctx.story.unresolved_goals ?? []).join(" · ")}
          </p>
        )}
      </div>

      <div className={styles.contextSection}>
        <strong>Scene: {ctx.scene.title}</strong>
        {ctx.scene.synopsis && <p className={styles.ctxNote}>{ctx.scene.synopsis}</p>}
        {ctx.scene.purpose && <p className={styles.ctxNote}>Purpose: {ctx.scene.purpose}</p>}
        {ctx.scene.entry_state && <p className={styles.ctxNote}>Entry: {ctx.scene.entry_state}</p>}
        {ctx.scene.exit_state && <p className={styles.ctxNote}>Goal: {ctx.scene.exit_state}</p>}
      </div>

      {ctx.characters_in_scene.length > 0 && (
        <div className={styles.contextSection}>
          <strong>Characters in scene</strong>
          {ctx.characters_in_scene.map((c) => (
            <p key={c.name} className={styles.ctxNote}>
              {c.name} ({c.role}){c.motivation ? ` — ${c.motivation.slice(0, 80)}` : ""}
            </p>
          ))}
        </div>
      )}

      {ctx.threads_in_scene.length > 0 && (
        <div className={styles.contextSection}>
          <strong>Active threads</strong>
          {ctx.threads_in_scene.map((t) => (
            <p key={t.name} className={styles.ctxNote}>{t.name} [{t.status}]</p>
          ))}
        </div>
      )}

      {ctx.settings_in_scene.length > 0 && (
        <div className={styles.contextSection}>
          <strong>Settings</strong>
          {ctx.settings_in_scene.map((s) => (
            <p key={s.name} className={styles.ctxNote}>{s.name}{s.description ? ` — ${s.description.slice(0, 60)}` : ""}</p>
          ))}
        </div>
      )}
    </div>
  );
}

const STARTER_PROMPTS = [
  "What's the narrative purpose of this scene?",
  "Are there any consistency issues I should watch for?",
  "What does @-character need to show in this scene to move their arc forward?",
  "What tension could I raise here?",
  "What should the reader feel leaving this scene?",
];

export default function SceneChatPanel({ storyId, nodeId }: Props) {
  const { closeChatPanel } = useUIStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [ctx, setCtx] = useState<ChatContextPreview | null>(null);
  const [showCtx, setShowCtx] = useState(false);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [panelWidth, setPanelWidth] = useState(340);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionParams, setSessionParams] = useState<LLMParams | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastUserMsg = useRef("");
  const lastResponse = useRef("");
  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(340);
  const chronicleSessionId = useRef<string | null>(null);

  function startResize(e: React.MouseEvent) {
    isResizing.current = true;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = panelWidth;
    e.preventDefault();
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isResizing.current) return;
      const dx = resizeStartX.current - e.clientX;
      const newWidth = Math.max(260, Math.min(640, resizeStartWidth.current + dx));
      setPanelWidth(newWidth);
    }
    function onMouseUp() {
      isResizing.current = false;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);
  const transparency = useLLMTransparency();

  const { sources: contextSources } = useLLMContextSources(
    { context_type: "scene-chat", story_id: storyId, node_id: nodeId }
  );

  const { stream, text: chatStreamText, isStreaming: streaming } = useLLMStream({
    requestId: `scene-chat:${storyId}:${nodeId}`,
    label: "Scene assistant",
    onComplete: (full) => {
      lastResponse.current = full;
      transparency.recordInteraction();
      setMessages((prev) => [...prev, { role: "assistant", content: full }]);
      persist("assistant", full);
      inputRef.current?.focus();
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "[Error reaching LLM]" },
      ]);
    },
  });

  // Load context preview and create Chronicle session on mount
  useEffect(() => {
    setLoadingCtx(true);
    api.getChatContext(storyId, nodeId)
      .then((context) => {
        setCtx(context);
        // Create Chronicle session in background
        api.createChronicleSession({
          story_id: storyId,
          context_type: "scene",
          context_id: nodeId,
          context_label: context.scene?.title ?? "",
        }).then((session) => {
          chronicleSessionId.current = session.id;
        }).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoadingCtx(false));
  }, [storyId, nodeId]);

  // Scroll to bottom when new messages or streaming text arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatStreamText]);

  function persist(role: string, content: string) {
    if (!chronicleSessionId.current) return;
    api.addChronicleMessage(chronicleSessionId.current, { role, content }).catch(() => {});
  }

  function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setInput("");
    lastUserMsg.current = content;

    const userMsg: ChatMessage = { role: "user", content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    persist("user", content);

    stream((signal) => api.sendChatMessage(storyId, nodeId, nextMessages, signal, sessionParams));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
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
    <div className={styles.panel} style={{ width: panelWidth }}>
      <div className={styles.resizeHandle} onMouseDown={startResize} />
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Sparkles size={14} className={styles.headerIcon} />
          <span className={styles.headerTitle}>Scene Assistant</span>
        </div>
        <div className={styles.headerRight}>
          <button
            className={`${styles.headerBtn} ${showCtx ? styles.headerBtnActive : ""}`}
            onClick={() => setShowCtx((v) => !v)}
            title="Show context being used"
          >
            <Info size={13} />
            Context
            {showCtx ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
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
          <button className={styles.headerBtn} onClick={closeChatPanel} title="Close">
            <X size={13} />
          </button>
        </div>
      </div>

      <LLMContextSources sources={contextSources} />

      {/* Context preview */}
      {showCtx && (
        <div className={styles.contextPanel}>
          <div className={styles.contextHeaderRow}>
            <BookOpen size={12} />
            <span>What the AI knows about this scene</span>
          </div>
          {loadingCtx ? (
            <p className={styles.ctxNote}>Loading context…</p>
          ) : ctx ? (
            <ContextPreview ctx={ctx} />
          ) : (
            <p className={styles.ctxNote}>Context unavailable</p>
          )}
        </div>
      )}

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <Sparkles size={22} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>Scene Assistant</p>
            <p className={styles.emptyHint}>
              Ask anything about this scene — consistency, character motivation,
              narrative purpose, what comes next.
            </p>
            <div className={styles.starters}>
              {STARTER_PROMPTS.map((p) => (
                <button
                  key={p}
                  className={styles.starterBtn}
                  onClick={() => send(p)}
                  disabled={streaming}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.message} ${msg.role === "user" ? styles.userMessage : styles.assistantMessage}`}
          >
            <div className={styles.messageAvatar}>
              {msg.role === "user" ? <User2 size={13} /> : <Bot size={13} />}
            </div>
            <div className={styles.messageContent}>{msg.content}</div>
          </div>
        ))}
        {chatStreamText && (
          <div className={`${styles.message} ${styles.assistantMessage}`}>
            <div className={styles.messageAvatar}><Bot size={13} /></div>
            <div className={styles.messageContent}>{chatStreamText}</div>
          </div>
        )}
        {streaming && !chatStreamText && (
          <div className={`${styles.message} ${styles.assistantMessage}`}>
            <div className={styles.messageAvatar}><Bot size={13} /></div>
            <div className={styles.messageContent}><span className={styles.cursor}>▋</span></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={styles.inputRow}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this scene… (Enter to send, Shift+Enter for newline)"
          className={styles.input}
          rows={2}
          disabled={streaming}
        />
        <button
          className={styles.sendBtn}
          onClick={() => send()}
          disabled={!input.trim() || streaming}
          title="Send"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
    </>
  );
}
