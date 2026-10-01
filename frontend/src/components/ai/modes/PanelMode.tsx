import { slotVar } from "../../../lib/colorSlots";
import { readFrames } from "../../../lib/ai/eventStream";
import { useState, useEffect, useRef, useCallback } from "react";
import { Eraser, FoldVertical, Users } from "lucide-react";
import { api } from "../../../api/client";
import { conversationsApi } from "../../../api/conversations";
import { useAIStore } from "../../../stores/aiStore";
import { useStoryStore } from "../../../stores/storyStore";
import type { AISession } from "../../../stores/aiStore";
import type { PanelMessage, PanelStreamEvent, LLMParams } from "../../../types";
import { useAIModeState } from "../../../hooks/useAIModeState";
import AIModeWrapper from "../AIModeWrapper";
import MentionComposer from "../shared/MentionComposer";
import styles from "./PanelMode.module.css";
import { toast } from "../../../stores/toastStore";

interface Props {
  session: AISession;
}

/** The server folds lines into a summary once there are this many (routers/panel_interviews.py). */
const COMPACT_AT = 10;

export default function PanelMode({ session }: Props) {
  const state = useAIModeState(session);
  const { _setBackendSessionId, updateSessionContext } = useAIStore();
  const { characters } = useStoryStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [localMessages, setLocalMessages] = useState<PanelMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [responseLength, setResponseLength] = useState<"brief" | "normal" | "detailed">("normal");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const panelIdRef = useRef<string | null>(null);
  panelIdRef.current = session.backendSessionId ?? null;

  const storyId = session.context.storyId ?? "";

  // Load existing messages when panel is opened
  useEffect(() => {
    if (!session.backendSessionId) return;
    api
      .getPanel(session.backendSessionId)
      .then((p) => setLocalMessages(p.messages))
      .catch(() => {});
  }, [session.backendSessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, streamingText]);

  function charColor(charName: string): string {
    return slotVar(characters.find((c) => c.name === charName)?.color_slot, "var(--color-accent)");
  }

  async function handleCreate() {
    if (selectedIds.length < 2 || !storyId || creating) return;
    setCreating(true);
    try {
      const panel = await api.createPanel(storyId, {
        title: "Panel Interview",
        character_ids: selectedIds,
      });
      updateSessionContext(session.id, { characterIds: selectedIds });
      _setBackendSessionId(session.id, panel.id);
    } catch {
      // Keep setup UI on error
    } finally {
      setCreating(false);
    }
  }

  const [working, setWorking] = useState(false);
  const panelId = session.backendSessionId;

  async function clearHistory() {
    if (
      !panelId ||
      !window.confirm("Clear this group interview's history? The transcript stays in the Chronicle.")
    )
      return;
    setWorking(true);
    try {
      setLocalMessages((await conversationsApi.clearPanel(panelId)).messages);
    } finally {
      setWorking(false);
    }
  }

  async function compactHistory() {
    if (!panelId) return;
    setWorking(true);
    try {
      setLocalMessages((await conversationsApi.compactPanel(panelId)).messages);
    } catch {
      toast.error("The history could not be compacted. It is unchanged.");
    } finally {
      setWorking(false);
    }
  }

  const historyActions = panelId && localMessages.length > 0 && (
    <>
      {localMessages.length >= COMPACT_AT && (
        <button
          type="button"
          className={styles.historyBtn}
          onClick={() => void compactHistory()}
          disabled={working || sending}
          title="Compact history: summarize the older lines"
        >
          <FoldVertical size={13} aria-hidden /> Compact
        </button>
      )}
      <button
        type="button"
        className={styles.historyBtn}
        onClick={() => void clearHistory()}
        disabled={working || sending}
        title="Clear history and start over with the same characters"
      >
        <Eraser size={13} aria-hidden /> Clear
      </button>
    </>
  );

  function toggleChar(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function cancel() {
    abortRef.current?.abort();
  }

  const handleSend = useCallback(async () => {
    const panelId = panelIdRef.current;
    if (!panelId || !state.input.trim() || sending) return;
    const content = state.input.trim();
    state.setInput("");
    setSending(true);
    setCurrentSpeaker(null);
    setStreamingText("");

    const userMsg: PanelMessage = {
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMsg]);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await api.sendPanelMessage(
        panelId,
        content,
        abort.signal,
        state.sessionParams as LLMParams | undefined,
        responseLength,
      );
      if (!res.ok || !res.body) {
        setSending(false);
        return;
      }

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
          const finished = accumText.trim();
          if (finished && activeCharName) {
            const charMsg: PanelMessage = {
              role: "character",
              character_name: activeCharName,
              character_id: activeCharId || undefined,
              content: finished,
              timestamp: new Date().toISOString(),
            };
            setLocalMessages((prev) => [...prev, charMsg]);
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
          try {
            const updated = await api.getPanel(panelId);
            setLocalMessages(updated.messages);
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
    }
  }, [state.input, state.sessionParams, state.setInput, sending, responseLength]);

  // ── Setup UI: pick 2+ characters ──────────────────────────────────────────
  if (!session.backendSessionId) {
    return (
      <AIModeWrapper
        session={session}
        state={state}
        icon={Users}
        title="Panel Interview"
        hideTokenBadge
        hideSettings
      >
        <div className={styles.setup}>
          <Users size={22} className={styles.setupIcon} />
          <p className={styles.setupTitle}>Set up a panel interview</p>
          <p className={styles.setupHint}>Select 2–3 characters to interview together.</p>
          {characters.length === 0 ? (
            <p className={styles.setupEmpty}>No characters found in this story.</p>
          ) : (
            <div className={styles.charGrid}>
              {characters.map((c) => (
                <button
                  key={c.id}
                  className={`${styles.charChip} ${selectedIds.includes(c.id) ? styles.charChipSelected : ""}`}
                  onClick={() => toggleChar(c.id)}
                  style={
                    selectedIds.includes(c.id)
                      ? {
                          borderColor: slotVar(c.color_slot, "var(--color-accent)"),
                          color: slotVar(c.color_slot, "var(--color-accent)"),
                        }
                      : {}
                  }
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <button
            className={styles.createBtn}
            onClick={handleCreate}
            disabled={selectedIds.length < 2 || selectedIds.length > 3 || creating || !storyId}
          >
            {creating ? "Creating…" : `Start panel (${selectedIds.length} selected)`}
          </button>
          {selectedIds.length > 3 && (
            <p className={styles.setupHint} style={{ color: "var(--color-danger)" }}>
              Maximum 3 characters per panel.
            </p>
          )}
        </div>
      </AIModeWrapper>
    );
  }

  // ── Active panel conversation ─────────────────────────────────────────────
  return (
    <AIModeWrapper
      session={session}
      state={state}
      icon={Users}
      title="Panel Interview"
      headerExtra={historyActions}
    >
      <div className={styles.messages}>
        {localMessages.length === 0 && !sending && (
          <div className={styles.emptyMsg}>
            <p>Ask the panel something to begin.</p>
          </div>
        )}
        {localMessages.map((msg, i) => {
          if (msg.role === "summary") {
            return (
              <div key={i} className={styles.summaryMsg}>
                <span className={styles.userLabel}>Earlier, in summary</span>
                <p className={styles.userText}>{msg.content}</p>
              </div>
            );
          }
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
              <span className={styles.charName} style={{ color: charColor(msg.character_name ?? "") }}>
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

        {/* Orchestrator thinking */}
        {sending && !currentSpeaker && (
          <div className={styles.thinking}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className={styles.lengthRow}>
        {(["brief", "normal", "detailed"] as const).map((opt) => (
          <button
            key={opt}
            className={`${styles.lengthBtn} ${responseLength === opt ? styles.lengthBtnActive : ""}`}
            onClick={() => setResponseLength(opt)}
          >
            {opt}
          </button>
        ))}
      </div>

      <MentionComposer
        sessionId={session.id}
        value={state.input}
        onChange={state.setInput}
        onSend={handleSend}
        onCancel={cancel}
        disabled={sending}
        placeholder="Ask the panel something…"
      />
    </AIModeWrapper>
  );
}
