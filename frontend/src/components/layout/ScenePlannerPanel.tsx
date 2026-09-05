/**
 * ScenePlannerPanel — AI-assisted scene planning guide.
 *
 * Returns structured JSON output rendered as section cards.
 * Conversational follow-ups use the same endpoint; graceful fallback to raw text.
 */
import { useState, useRef, useEffect } from "react";
import {
  X,
  Map,
  User2,
  ChevronDown,
  ChevronUp,
  FileText,
  Target,
  LogIn,
  LogOut,
  List,
  Users,
  GitBranch,
} from "lucide-react";
import { api } from "../../api/client";
import { useUIStore } from "../../stores/uiStore";
import { useStoryStore } from "../../stores/storyStore";
import type { ChatMessage, StructuredResult } from "../../types";
import StructuredResponseRenderer, { type SectionConfig } from "../ai/StructuredResponseRenderer";
import ChatImagePicker from "./ChatImagePicker";
import styles from "./ScenePlannerPanel.module.css";

interface Props {
  storyId: string;
  nodeId: string;
}

interface PlanTurn {
  userContent: string;
  userImages?: string[];
  result: StructuredResult;
}

const SCENE_PLAN_SCHEMA: SectionConfig[] = [
  {
    key: "synopsis",
    label: "Synopsis",
    icon: FileText,
    color: "var(--color-accent)",
    type: "text",
    applyable: true,
  },
  { key: "purpose", label: "Purpose", icon: Target, color: "var(--color-warning)", type: "text" },
  {
    key: "entry_state",
    label: "Entry State",
    icon: LogIn,
    color: "var(--segment-part)",
    type: "text",
    applyable: true,
  },
  {
    key: "exit_state",
    label: "Exit State",
    icon: LogOut,
    color: "var(--segment-beat)",
    type: "text",
    applyable: true,
  },
  {
    key: "key_events",
    label: "Key Events",
    icon: List,
    color: "var(--segment-scene)",
    type: "list",
    applyable: true,
  },
  {
    key: "characters_to_feature",
    label: "Characters to Feature",
    icon: Users,
    color: "var(--color-success)",
    type: "sublist",
    labelField: "name",
    descField: "reason",
  },
  {
    key: "threads_to_advance",
    label: "Threads to Advance",
    icon: GitBranch,
    color: "var(--color-ai)",
    type: "sublist",
    labelField: "name",
    descField: "how",
  },
];

const FOLLOW_UPS = [
  "Give me an alternative direction for this scene.",
  "What characters should be in this scene?",
  "Which plot threads should this scene advance?",
  "How does this scene connect to the next one?",
  "What's the emotional core of this scene?",
];

export default function ScenePlannerPanel({ storyId, nodeId }: Props) {
  const { closePlannerPanel } = useUIStore();
  const { activeNode, setActiveNode } = useStoryStore();
  const [turns, setTurns] = useState<PlanTurn[]>([]);
  const [pendingUser, setPendingUser] = useState<string>("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [initialNotes, setInitialNotes] = useState("");
  const [showingNotesForm, setShowingNotesForm] = useState(true);
  const [panelWidth, setPanelWidth] = useState(380);
  const [showFollowUps, setShowFollowUps] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    base64: string;
    mimeType: string;
    filename: string;
    assetId?: string;
  } | null>(null);
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, generating]);

  /** Build the API message history from completed turns */
  function buildApiMessages(completedTurns: PlanTurn[]): ChatMessage[] {
    return completedTurns.flatMap((t) => [
      {
        role: "user" as const,
        content: t.userContent,
        ...(t.userImages?.length ? { images: t.userImages } : {}),
      },
      { role: "assistant" as const, content: t.result.raw_text ?? JSON.stringify(t.result.data) ?? "" },
    ]);
  }

  async function callApi(messages: ChatMessage[], notes?: string): Promise<StructuredResult> {
    return api.sendScenePlanMessage(storyId, nodeId, messages, notes);
  }

  async function handleStart() {
    setShowingNotesForm(false);
    setShowFollowUps(false);

    const content = initialNotes.trim()
      ? `Help me plan this scene. Here's what I know so far: ${initialNotes}`
      : "Help me plan this scene.";

    setPendingUser(content);
    setGenerating(true);
    try {
      const apiMessages: ChatMessage[] = [{ role: "user", content }];
      const result = await callApi(apiMessages, initialNotes || undefined);
      setTurns([{ userContent: content, result }]);
      setShowFollowUps(true);
      inputRef.current?.focus();
    } catch {
      setTurns([{ userContent: content, result: { success: false, raw_text: "[Error reaching LLM]" } }]);
    } finally {
      setPendingUser("");
      setPendingImages([]);
      setGenerating(false);
    }
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || generating) return;
    setInput("");
    setShowFollowUps(false);

    const images = selectedImage ? [selectedImage.base64] : [];
    setSelectedImage(null);
    setPendingUser(content);
    setPendingImages(images);
    setGenerating(true);

    try {
      const history = buildApiMessages(turns);
      const userMsg: ChatMessage = { role: "user", content, ...(images.length ? { images } : {}) };
      const result = await callApi([...history, userMsg]);
      setTurns((prev) => [
        ...prev,
        { userContent: content, userImages: images.length ? images : undefined, result },
      ]);
      setShowFollowUps(true);
      inputRef.current?.focus();
    } catch {
      setTurns((prev) => [
        ...prev,
        { userContent: content, result: { success: false, raw_text: "[Error reaching LLM]" } },
      ]);
    } finally {
      setPendingUser("");
      setPendingImages([]);
      setGenerating(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function reset() {
    setTurns([]);
    setInitialNotes("");
    setShowingNotesForm(true);
    setShowFollowUps(false);
    setGenerating(false);
  }

  async function handleApply(key: string, value: unknown) {
    const update: Record<string, string> = {};
    if (key === "synopsis") update.synopsis = String(value);
    else if (key === "entry_state") update.entry_state = String(value);
    else if (key === "exit_state") update.exit_state = String(value);
    else if (key === "key_events")
      update.key_events = Array.isArray(value) ? (value as string[]).join("\n") : String(value);
    else return;

    const updated = await api.updateNode(nodeId, update);
    if (activeNode?.id === nodeId) setActiveNode(updated);
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
          {!showingNotesForm && turns.length > 0 && (
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
            I'll suggest ideas for how this scene might work — synopsis, purpose, entry &amp; exit state, key
            events — based on your story's context.
          </p>
          <p className={styles.notesIntro} style={{ marginTop: "2px" }}>
            These are starting points for your own thinking, not instructions. Share what you already have in
            mind, or let me work from the story alone.
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
            <button className={styles.startBtn} onClick={handleStart} disabled={generating}>
              Plan this scene
            </button>
          </div>
        </div>
      )}

      {/* Turns */}
      {!showingNotesForm && (
        <div className={styles.messages}>
          {turns.map((turn, i) => (
            <div key={i}>
              {/* User message */}
              <div className={`${styles.message} ${styles.userMessage}`}>
                <div className={styles.messageAvatar}>
                  <User2 size={13} />
                </div>
                <div className={styles.messageContent}>
                  {turn.userImages && turn.userImages.length > 0 && (
                    <div className={styles.messageImages}>
                      {turn.userImages.map((b64, idx) => (
                        <img
                          key={idx}
                          src={`data:image/jpeg;base64,${b64}`}
                          alt="attached"
                          className={styles.messageImage}
                        />
                      ))}
                    </div>
                  )}
                  {turn.userContent}
                </div>
              </div>
              {/* AI response */}
              <div className={`${styles.message} ${styles.assistantMessage}`}>
                <div className={styles.messageAvatar}>
                  <Map size={13} />
                </div>
                <div className={styles.messageContent}>
                  <StructuredResponseRenderer
                    result={turn.result}
                    schema={SCENE_PLAN_SCHEMA}
                    onApply={handleApply}
                    applyLabel="Apply to scene"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Pending user message while generating */}
          {generating && pendingUser && (
            <div className={`${styles.message} ${styles.userMessage}`}>
              <div className={styles.messageAvatar}>
                <User2 size={13} />
              </div>
              <div className={styles.messageContent}>
                {pendingImages.length > 0 && (
                  <div className={styles.messageImages}>
                    {pendingImages.map((b64, idx) => (
                      <img
                        key={idx}
                        src={`data:image/jpeg;base64,${b64}`}
                        alt="attached"
                        className={styles.messageImage}
                      />
                    ))}
                  </div>
                )}
                {pendingUser}
              </div>
            </div>
          )}
          {generating && (
            <div className={`${styles.message} ${styles.assistantMessage}`}>
              <div className={styles.messageAvatar}>
                <Map size={13} />
              </div>
              <div className={styles.messageContent}>
                <span className={styles.cursor}>▋</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {/* Follow-up suggestions */}
      {!showingNotesForm && turns.length > 0 && !generating && (
        <div className={styles.followUps}>
          <button className={styles.followUpsToggle} onClick={() => setShowFollowUps((v) => !v)}>
            <span>Ask a follow-up</span>
            {showFollowUps ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          {showFollowUps && (
            <div className={styles.followUpsList}>
              {FOLLOW_UPS.map((p) => (
                <button key={p} className={styles.followUpBtn} onClick={() => send(p)} disabled={generating}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input */}
      {!showingNotesForm && (
        <div className={styles.inputRow}>
          <ChatImagePicker
            storyId={storyId}
            selected={selectedImage}
            onSelect={setSelectedImage}
            disabled={generating}
          />
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up… (Enter to send)"
            className={styles.input}
            rows={2}
            disabled={generating}
          />
          <button
            className={styles.sendBtn}
            onClick={() => send()}
            disabled={(!input.trim() && !selectedImage) || generating}
            title="Send"
          >
            <Map size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
