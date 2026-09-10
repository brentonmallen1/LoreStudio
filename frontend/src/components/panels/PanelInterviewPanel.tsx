import { readFrames } from "../../lib/ai/eventStream";
import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, Send, Square, Users, Settings2 } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type {
  PanelInterview,
  PanelInterviewSummary,
  PanelMessage,
  PanelStreamEvent,
  LLMParams,
} from "../../types";
import CreatePanelDialog from "./CreatePanelDialog";
import { useLLMTransparency } from "../../hooks/useLLMTransparency";
import { useLLMContextSources } from "../../hooks/useLLMContextSources";
import { LLMTransparencyModal, LLMTransparencyTrigger, LLMContextSources, ChatSettingsModal } from "../llm";
import styles from "./PanelInterviewPanel.module.css";

interface Props {
  storyId: string;
}

const CHAR_COLORS = ["var(--color-accent)", "#e8854a", "#4aae8c", "#c45fc4", "#5f9ce8", "#c4b44a"];

export default function PanelInterviewPanel({ storyId }: Props) {
  const { characters } = useStoryStore();
  const [panels, setPanels] = useState<PanelInterviewSummary[]>([]);
  const [activePanel, setActivePanel] = useState<PanelInterview | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activePanelRef = useRef<PanelInterview | null>(null);
  activePanelRef.current = activePanel;
  const transparency = useLLMTransparency();

  const panelId = activePanel?.id ?? "";
  const [showSettings, setShowSettings] = useState(false);
  const [sessionParams, setSessionParams] = useState<LLMParams | undefined>();
  const [responseLength, setResponseLength] = useState<"brief" | "normal" | "detailed">("normal");

  const { sources: contextSources } = useLLMContextSources(
    panelId ? { context_type: "panel", panel_id: panelId } : null,
  );

  useEffect(() => {
    api
      .listPanels(storyId)
      .then(setPanels)
      .catch(() => {});
  }, [storyId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activePanel?.messages, streamingText]);

  function charColor(charName: string): string {
    const idx = (activePanel?.character_ids ?? []).findIndex((id) => {
      const c = characters.find((x) => x.id === id);
      return c?.name === charName;
    });
    return CHAR_COLORS[Math.max(0, idx) % CHAR_COLORS.length];
  }

  async function openPanel(id: string) {
    try {
      const panel = await api.getPanel(id);
      setActivePanel(panel);
    } catch {
      /* ignore */
    }
  }

  async function handleCreated(panel: PanelInterview) {
    setShowCreate(false);
    setActivePanel(panel);
    const summaries = await api.listPanels(storyId);
    setPanels(summaries);
  }

  async function doDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setPendingDeleteId(null);
    await api.deletePanel(id);
    setPanels((prev) => prev.filter((p) => p.id !== id));
    if (activePanel?.id === id) setActivePanel(null);
  }

  function cancel() {
    abortRef.current?.abort();
  }

  const handleSend = useCallback(async () => {
    const panel = activePanelRef.current;
    if (!panel || !inputText.trim() || sending) return;
    const content = inputText.trim();
    setInputText("");
    setSending(true);
    setCurrentSpeaker(null);
    setStreamingText("");

    // Optimistically add user message
    const userMsg: PanelMessage = {
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    setActivePanel((prev) => (prev ? { ...prev, messages: [...prev.messages, userMsg] } : prev));

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await api.sendPanelMessage(panel.id, content, abort.signal, sessionParams, responseLength);
      if (!res.ok || !res.body) {
        setSending(false);
        return;
      }

      // Local vars track in-progress character so we can commit on "end"
      // without depending on async React state.
      let activeCharName = "";
      let activeCharId = "";
      let accumText = "";

      await readFrames(res, async (frame) => {
        const event = { event: frame.event, ...frame.data } as unknown as PanelStreamEvent;
        if (event.event === "start") {
          activeCharName = event.character ?? "";
          activeCharId = event.character_id ?? "";
          accumText = "";
          setCurrentSpeaker(activeCharName);
          setStreamingText("");
        } else if (event.event === "token") {
          accumText += event.delta ?? "";
          setStreamingText((prev) => prev + (event.delta ?? ""));
        } else if (event.event === "end") {
          // Commit completed message to local state immediately so it
          // stays visible while the next character starts streaming.
          const finished = accumText.trim();
          if (finished && activeCharName) {
            const charMsg: PanelMessage = {
              role: "character",
              character_name: activeCharName,
              character_id: activeCharId || undefined,
              content: finished,
              timestamp: new Date().toISOString(),
            };
            setActivePanel((prev) => (prev ? { ...prev, messages: [...prev.messages, charMsg] } : prev));
          }
          activeCharName = "";
          activeCharId = "";
          accumText = "";
          setCurrentSpeaker(null);
          setStreamingText("");
        } else if (event.event === "pass") {
          activeCharName = "";
          activeCharId = "";
          accumText = "";
          setCurrentSpeaker(null);
          setStreamingText("");
        } else if (event.event === "done") {
          // Sync with backend to pick up any backend-only state
          try {
            const updated = await api.getPanel(panel.id);
            setActivePanel(updated);
          } catch {
            /* ignore */
          }
        }
      });
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        // Error handled silently
      }
    } finally {
      setSending(false);
      setCurrentSpeaker(null);
      setStreamingText("");
      transparency.recordInteraction();
    }
  }, [inputText, sending, sessionParams, responseLength, transparency]);

  const panelCharacterNames = (panel: PanelInterviewSummary) =>
    panel.character_ids.map((id) => characters.find((c) => c.id === id)?.name ?? "?").join(", ");

  return (
    <>
      <LLMTransparencyModal
        isOpen={transparency.isOpen}
        onClose={transparency.close}
        data={transparency.data}
      />
      <ChatSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onApply={setSessionParams}
        sessionParams={sessionParams}
      />
      <div className={styles.page}>
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>Group Interviews</span>
            <button onClick={() => setShowCreate(true)} className={styles.newBtn} aria-label="New panel">
              <Plus size={13} />
            </button>
          </div>
          <div className={styles.panelList}>
            {panels.length === 0 && <p className={styles.emptyHint}>No group interviews yet.</p>}
            {panels.map((p) => (
              <div
                key={p.id}
                className={`${styles.panelItem} ${activePanel?.id === p.id ? styles.panelActive : ""}`}
                onClick={() => openPanel(p.id)}
              >
                <Users size={12} className={styles.panelIcon} />
                <div className={styles.panelMeta}>
                  <span className={styles.panelTitle}>{p.title}</span>
                  <span className={styles.panelChars}>{panelCharacterNames(p)}</span>
                </div>
                {pendingDeleteId === p.id ? (
                  <div className={styles.deleteConfirm} onClick={(e) => e.stopPropagation()}>
                    <button className={styles.deleteConfirmYes} onClick={(e) => doDelete(p.id, e)}>
                      Delete
                    </button>
                    <button
                      className={styles.deleteConfirmNo}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDeleteId(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDeleteId(p.id);
                    }}
                    aria-label="Delete panel"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.main}>
          {!activePanel ? (
            <div className={styles.emptyState}>
              <Users size={36} className={styles.emptyIcon} />
              <p className={styles.emptyText}>Select or create a group interview</p>
              <button onClick={() => setShowCreate(true)} className={styles.emptyBtn}>
                New group interview
              </button>
            </div>
          ) : (
            <>
              <div className={styles.chatHeader}>
                <Users size={14} className={styles.chatHeaderIcon} />
                <span className={styles.chatTitle}>{activePanel.title}</span>
                <div className={styles.lengthToggle}>
                  {(["brief", "normal", "detailed"] as const).map((opt) => (
                    <button
                      key={opt}
                      className={`${styles.lengthBtn} ${responseLength === opt ? styles.lengthBtnActive : ""}`}
                      onClick={() => setResponseLength(opt)}
                      title={`Response length: ${opt}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <LLMTransparencyTrigger
                  disabled={!transparency.hasData}
                  onClick={() =>
                    transparency.open({ context_type: "panel", panel_id: activePanel.id }, "", {
                      feature: "panel-character",
                      story_id: activePanel.story_id,
                    })
                  }
                />
                <button
                  className={`${styles.chatHeaderBtn} ${sessionParams ? styles.chatHeaderBtnActive : ""}`}
                  onClick={() => setShowSettings(true)}
                  title="AI parameters"
                >
                  <Settings2 size={13} />
                </button>
              </div>

              <LLMContextSources sources={contextSources} />

              <div className={styles.messages}>
                {activePanel.messages.map((msg, i) => {
                  if (msg.role === "user") {
                    return (
                      <div key={i} className={styles.userMsg}>
                        <span className={styles.userLabel}>You</span>
                        <p className={styles.userText}>{msg.content}</p>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className={styles.charBlock}>
                      <span
                        className={styles.charName}
                        style={{ color: charColor(msg.character_name ?? "") }}
                      >
                        {msg.character_name}
                      </span>
                      <p className={styles.charText}>{msg.content}</p>
                    </div>
                  );
                })}

                {/* Currently streaming character */}
                {currentSpeaker && (
                  <div className={styles.charBlock}>
                    <span className={styles.charName} style={{ color: charColor(currentSpeaker) }}>
                      {currentSpeaker}
                    </span>
                    <p className={styles.charText}>{streamingText || "…"}</p>
                  </div>
                )}

                {/* Orchestrator thinking (no speaker yet) */}
                {sending && !currentSpeaker && (
                  <div className={styles.thinking}>
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              <div className={styles.inputRow}>
                <input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Ask the panel something…"
                  className={styles.input}
                  disabled={sending}
                />
                {sending ? (
                  <button
                    onClick={cancel}
                    className={styles.sendBtn}
                    style={{
                      background: "color-mix(in srgb, var(--color-danger) 15%, transparent)",
                      color: "var(--color-danger)",
                    }}
                    aria-label="Cancel"
                  >
                    <Square size={13} />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim()}
                    className={styles.sendBtn}
                    aria-label="Send"
                  >
                    <Send size={14} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {showCreate && (
          <CreatePanelDialog
            storyId={storyId}
            onCreated={handleCreated}
            onClose={() => setShowCreate(false)}
          />
        )}
      </div>
    </>
  );
}
