import { useState, useRef, useEffect } from "react";
import { X, Send, Compass, User2, Brain, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../../api/client";
import { useUIStore } from "../../stores/uiStore";
import type { ChatMessage, BrainstormIntent } from "../../types";
import { useLLMStream } from "../../hooks/useLLMStream";
import ChatImagePicker from "./ChatImagePicker";
import styles from "./BrainstormPanel.module.css";

interface Props {
  storyId: string;
  nodeId: string;
}

const MOOD_OPTIONS = [
  { value: "", label: "Not sure yet" },
  { value: "tense / suspenseful", label: "Tense / suspenseful" },
  { value: "quiet / contemplative", label: "Quiet / contemplative" },
  { value: "building / escalating", label: "Building / escalating" },
  { value: "resolving / cathartic", label: "Resolving / cathartic" },
  { value: "surprising / twist", label: "Surprising / twist" },
  { value: "bittersweet", label: "Bittersweet" },
  { value: "darkening", label: "Darkening" },
  { value: "hopeful", label: "Hopeful" },
];

const FOLLOW_UP_PROMPTS = [
  "What's a darker direction?",
  "What's a lighter direction?",
  "Which direction best serves the story's arc?",
  "Tell me more about the first possibility.",
  "What if the reader needs to feel hopeful here?",
];

const THINKING_RE = /<\|channel>thought\n([\s\S]*?)<channel\|>/g;

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

interface IntentFormProps {
  onStart: (intent: BrainstormIntent) => void;
}

function IntentForm({ onStart }: IntentFormProps) {
  const [mood, setMood] = useState("");
  const [goal, setGoal] = useState("");
  const [required, setRequired] = useState("");

  return (
    <div className={styles.intentForm}>
      <p className={styles.intentLabel}>
        Before we brainstorm — a few quick questions. These are optional, but the more
        you share, the more targeted the directions.
      </p>

      <div className={styles.intentField}>
        <label className={styles.intentFieldLabel}>What mood are you leaning toward?</label>
        <select
          className={styles.intentSelect}
          value={mood}
          onChange={(e) => setMood(e.target.value)}
        >
          {MOOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.intentField}>
        <label className={styles.intentFieldLabel}>
          Where should this leave the reader?
        </label>
        <input
          className={styles.intentInput}
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. worried, satisfied, curious, unsettled…"
        />
      </div>

      <div className={styles.intentField}>
        <label className={styles.intentFieldLabel}>
          Anything specific that needs to happen?
        </label>
        <textarea
          className={styles.intentTextarea}
          value={required}
          onChange={(e) => setRequired(e.target.value)}
          placeholder="Optional: a plot point, character moment, or revelation that must occur…"
          rows={2}
        />
      </div>

      <div className={styles.intentActions}>
        <button
          className={styles.intentSkipBtn}
          onClick={() => onStart({})}
        >
          Skip, just brainstorm
        </button>
        <button
          className={styles.intentStartBtn}
          onClick={() => onStart({ mood: mood || undefined, goal: goal || undefined, required_events: required || undefined })}
        >
          Start brainstorming
        </button>
      </div>
    </div>
  );
}

export default function BrainstormPanel({ storyId, nodeId }: Props) {
  const { closeBrainstormPanel } = useUIStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string; filename: string; assetId?: string } | null>(null);
  const [intentCapture, setIntentCapture] = useState<BrainstormIntent | null>(null);
  const [showingForm, setShowingForm] = useState(true);
  const [panelWidth, setPanelWidth] = useState(360);
  const [showFollowUps, setShowFollowUps] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(360);

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
      const newWidth = Math.max(280, Math.min(680, resizeStartWidth.current + dx));
      setPanelWidth(newWidth);
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
    requestId: `brainstorm:${storyId}:${nodeId}`,
    label: "What's Next?",
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

  function buildInitialUserMessage(intent: BrainstormIntent): string {
    if (!intent.mood && !intent.goal && !intent.required_events) {
      return "Help me brainstorm what might happen next in this scene.";
    }
    const parts = ["I'm thinking through what happens next."];
    if (intent.mood) parts.push(`I'm leaning toward a ${intent.mood} direction.`);
    if (intent.goal) parts.push(`I want to leave the reader feeling ${intent.goal}.`);
    if (intent.required_events) parts.push(`Something that needs to happen: ${intent.required_events}.`);
    parts.push("What directions should I consider?");
    return parts.join(" ");
  }

  function handleStart(intent: BrainstormIntent) {
    setIntentCapture(intent);
    setShowingForm(false);
    setShowFollowUps(false);

    const userContent = buildInitialUserMessage(intent);
    const userMsg: ChatMessage = { role: "user", content: userContent };
    const nextMessages = [userMsg];
    setMessages(nextMessages);

    stream((signal) =>
      api.sendBrainstormMessage(storyId, nodeId, nextMessages, intent, signal)
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
      api.sendBrainstormMessage(storyId, nodeId, nextMessages, intentCapture ?? undefined, signal)
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function resetForm() {
    setMessages([]);
    setShowingForm(true);
    setShowFollowUps(false);
    setIntentCapture(null);
  }

  return (
    <div className={styles.panel} style={{ width: panelWidth }}>
      <div className={styles.resizeHandle} onMouseDown={startResize} />

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Compass size={14} className={styles.headerIcon} />
          <span className={styles.headerTitle}>What's Next?</span>
          <span className={styles.headerBadge}>Guide</span>
        </div>
        <div className={styles.headerRight}>
          {!showingForm && messages.length > 0 && (
            <button
              className={styles.headerBtn}
              onClick={resetForm}
              title="Start a new brainstorm"
            >
              New brainstorm
            </button>
          )}
          <button className={styles.headerBtn} onClick={closeBrainstormPanel} title="Close">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Intent form */}
      {showingForm && (
        <IntentForm onStart={handleStart} />
      )}

      {/* Messages */}
      {!showingForm && (
        <div className={styles.messages}>
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`${styles.message} ${msg.role === "user" ? styles.userMessage : styles.assistantMessage}`}
            >
              <div className={styles.messageAvatar}>
                {msg.role === "user" ? <User2 size={13} /> : <Compass size={13} />}
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
              <div className={styles.messageAvatar}><Compass size={13} /></div>
              <div className={styles.messageContent}>
                <MessageContent content={streamText} s={styles} />
              </div>
            </div>
          )}
          {streaming && !streamText && (
            <div className={`${styles.message} ${styles.assistantMessage}`}>
              <div className={styles.messageAvatar}><Compass size={13} /></div>
              <div className={styles.messageContent}><span className={styles.cursor}>▋</span></div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {/* Follow-up prompts */}
      {!showingForm && showFollowUps && !streaming && (
        <div className={styles.followUps}>
          <button
            className={styles.followUpsToggle}
            onClick={() => setShowFollowUps((v) => !v)}
          >
            <span>Suggestions</span>
            {showFollowUps ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
          </button>
          <div className={styles.followUpsList}>
            {FOLLOW_UP_PROMPTS.map((p) => (
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
      {!showingForm && (
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
            placeholder="Ask a follow-up… (Enter to send, Shift+Enter for newline)"
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
