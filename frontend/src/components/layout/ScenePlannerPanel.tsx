/**
 * ScenePlannerPanel — AI-assisted scene planning guide.
 *
 * Helps authors think through a scene BEFORE writing it by surfacing
 * structured suggestions (synopsis, purpose, entry/exit state, key events).
 *
 * This is a guide, not a co-author. Suggestions are for the author's
 * consideration — the author decides what to do with them.
 */
import { useState, useRef, useEffect } from "react";
import { X, Send, Map, Brain, User2, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../../api/client";
import { useUIStore } from "../../stores/uiStore";
import type { ChatMessage } from "../../types";
import { useLLMStream } from "../../hooks/useLLMStream";
import ChatImagePicker from "./ChatImagePicker";
import styles from "./ScenePlannerPanel.module.css";

interface Props {
  storyId: string;
  nodeId: string;
}

const THINKING_RE = /<\|channel>thought\n([\s\S]*?)<channel\|>/g;

const FOLLOW_UPS = [
  "Give me an alternative direction for this scene.",
  "What characters should be in this scene?",
  "Which plot threads should this scene advance?",
  "How does this scene connect to the next one?",
  "What's the emotional core of this scene?",
];

function MessageContent({ content, s }: { content: string; s: Record<string, string> }) {
  const thinkingBlocks: string[] = [];
  const mainContent = content.replace(THINKING_RE, (_, thought) => {
    thinkingBlocks.push(thought.trim());
    return "";
  }).trim();

  if (thinkingBlocks.length === 0) return <>{content}</>;

  return (
    <>
      <details className={s.thinkingBlock}>
        <summary className={s.thinkingSummary}>
          <Brain size={11} />
          Thinking
        </summary>
        <div className={s.thinkingContent}>{thinkingBlocks.join("\n\n")}</div>
      </details>
      {mainContent}
    </>
  );
}

export default function ScenePlannerPanel({ storyId, nodeId }: Props) {
  const { closePlannerPanel } = useUIStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [initialNotes, setInitialNotes] = useState("");
  const [showingNotesForm, setShowingNotesForm] = useState(true);
  const [panelWidth, setPanelWidth] = useState(380);
  const [showFollowUps, setShowFollowUps] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string; filename: string; assetId?: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(380);

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
      setPanelWidth(Math.max(300, Math.min(720, resizeStartWidth.current + dx)));
    }
    function onMouseUp() { isResizing.current = false; }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const { stream, text: streamText, isStreaming: streaming } = useLLMStream({
    requestId: `scene-plan:${storyId}:${nodeId}`,
    label: "Scene Planner",
    tabId: "story",
    onComplete: (full) => {
      setMessages((prev) => [...prev, { role: "assistant", content: full }]);
      setShowFollowUps(true);
      inputRef.current?.focus();
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "[Error reaching LLM]" },
      ]);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  function handleStart() {
    setShowingNotesForm(false);
    setShowFollowUps(false);

    const content = initialNotes.trim()
      ? `Help me plan this scene. Here's what I know so far: ${initialNotes}`
      : "Help me plan this scene.";

    const userMsg: ChatMessage = { role: "user", content };
    const nextMessages = [userMsg];
    setMessages(nextMessages);

    stream((signal) =>
      api.sendScenePlanMessage(storyId, nodeId, nextMessages, initialNotes || undefined, signal)
    );
  }

  function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setInput("");
    setShowFollowUps(false);

    const userMsg: ChatMessage = {
      role: "user",
      content,
      ...(selectedImage ? { images: [selectedImage.base64] } : {}),
    };
    setSelectedImage(null);
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);

    stream((signal) =>
      api.sendScenePlanMessage(storyId, nodeId, nextMessages, undefined, signal)
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function reset() {
    setMessages([]);
    setInitialNotes("");
    setShowingNotesForm(true);
    setShowFollowUps(false);
  }

  return (
    <div className={styles.panel} style={{ width: panelWidth }}>
      <div className={styles.resizeHandle} onMouseDown={startResize} />

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Map size={14} className={styles.headerIcon} />
          <span className={styles.headerTitle}>Scene Planner</span>
          <span className={styles.headerBadge}>Plan</span>
        </div>
        <div className={styles.headerRight}>
          {!showingNotesForm && messages.length > 0 && (
            <button className={styles.headerBtn} onClick={reset} title="Start over">
              New plan
            </button>
          )}
          <button className={styles.headerBtn} onClick={closePlannerPanel} title="Close">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Initial notes form */}
      {showingNotesForm && (
        <div className={styles.notesForm}>
          <p className={styles.notesIntro}>
            I'll suggest ideas for how this scene might work — synopsis, purpose, entry &amp; exit
            state, key events — based on your story's context.
          </p>
          <p className={styles.notesIntro} style={{ marginTop: "2px" }}>
            These are starting points for your own thinking, not instructions. Share what you already
            have in mind, or let me work from the story alone.
          </p>
          <div className={styles.notesField}>
            <label className={styles.notesLabel}>What do you already know about this scene?</label>
            <textarea
              className={styles.notesTextarea}
              value={initialNotes}
              onChange={(e) => setInitialNotes(e.target.value)}
              placeholder="Optional: a character moment you have in mind, a plot point that needs to happen, the general vibe…"
              rows={4}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleStart();
              }}
            />
          </div>
          <div className={styles.notesActions}>
            <button className={styles.skipBtn} onClick={handleStart}>
              Skip, plan from story context
            </button>
            <button
              className={styles.startBtn}
              onClick={handleStart}
              disabled={streaming}
            >
              Plan this scene
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      {!showingNotesForm && (
        <div className={styles.messages}>
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`${styles.message} ${msg.role === "user" ? styles.userMessage : styles.assistantMessage}`}
            >
              <div className={styles.messageAvatar}>
                {msg.role === "user" ? <User2 size={13} /> : <Map size={13} />}
              </div>
              <div className={styles.messageContent}>
                {msg.images && msg.images.length > 0 && (
                  <div className={styles.messageImages}>
                    {msg.images.map((b64, idx) => (
                      <img key={idx} src={`data:image/jpeg;base64,${b64}`} alt="attached" className={styles.messageImage} />
                    ))}
                  </div>
                )}
                {msg.role === "assistant"
                  ? <MessageContent content={msg.content} s={styles} />
                  : msg.content}
              </div>
            </div>
          ))}

          {streaming && streamText && (
            <div className={`${styles.message} ${styles.assistantMessage}`}>
              <div className={styles.messageAvatar}><Map size={13} /></div>
              <div className={styles.messageContent}>
                <MessageContent content={streamText} s={styles} />
              </div>
            </div>
          )}
          {streaming && !streamText && (
            <div className={`${styles.message} ${styles.assistantMessage}`}>
              <div className={styles.messageAvatar}><Map size={13} /></div>
              <div className={styles.messageContent}><span className={styles.cursor}>▋</span></div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {/* Follow-up suggestions */}
      {!showingNotesForm && showFollowUps && !streaming && (
        <div className={styles.followUps}>
          <button
            className={styles.followUpsToggle}
            onClick={() => setShowFollowUps((v) => !v)}
          >
            <span>Ask a follow-up</span>
            {showFollowUps ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
          </button>
          <div className={styles.followUpsList}>
            {FOLLOW_UPS.map((p) => (
              <button
                key={p}
                className={styles.followUpBtn}
                onClick={() => send(p)}
                disabled={streaming}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      {!showingNotesForm && (
        <div className={styles.inputRow}>
          <ChatImagePicker
            storyId={storyId}
            selected={selectedImage}
            onSelect={setSelectedImage}
            disabled={streaming}
          />
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up… (Enter to send)"
            className={styles.input}
            rows={2}
            disabled={streaming}
          />
          <button
            className={styles.sendBtn}
            onClick={() => send()}
            disabled={(!input.trim() && !selectedImage) || streaming}
            title="Send"
          >
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
