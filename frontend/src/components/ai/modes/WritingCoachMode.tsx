import { useState, useEffect, useRef } from "react";
import { Feather, Orbit } from "lucide-react";
import { useAIStore } from "../../../stores/aiStore";
import type { AISession } from "../../../stores/aiStore";
import { useAIModeState } from "../../../hooks/useAIModeState";
import AIModeWrapper from "../AIModeWrapper";
import MessageList from "../shared/MessageList";
import MentionComposer from "../shared/MentionComposer";
import styles from "./WritingCoachMode.module.css";

const MOOD_PRESETS = ["Darker", "Lighter", "More Tense", "Calmer"];
const STYLE_PRESETS = ["Simpler", "Formal", "Poetic", "Direct"];

interface Props {
  session: AISession;
}

export default function WritingCoachMode({ session }: Props) {
  const state = useAIModeState(session);
  const { sendMessage, cancelStreaming } = useAIStore();
  const [tonePrefs, setTonePrefs] = useState<string[]>(session.context.tonePrefs ?? []);
  const autoSentRef = useRef(false);

  // Auto-send the initial coaching request once, when the session has no messages
  useEffect(() => {
    if (autoSentRef.current) return;
    if (session.messages.length > 0) {
      autoSentRef.current = true;
      return;
    }
    if (!session.context.selectedText) return;

    autoSentRef.current = true;

    const tones = tonePrefs.length > 0 ? `\n\nDirection I'm considering: ${tonePrefs.join(", ")}` : "";
    const content = `I'd like some coaching on this passage:\n\n"${session.context.selectedText}"${tones}`;
    sendMessage(session.id, content);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleTone(tone: string) {
    setTonePrefs((prev) => (prev.includes(tone) ? prev.filter((t) => t !== tone) : [...prev, tone]));
  }

  function handleSend(text?: string) {
    const content = (text ?? state.input).trim();
    if (!content || session.isStreaming) return;
    sendMessage(session.id, content, undefined, state.sessionParams);
    state.setInput("");
  }

  const selectedText = session.context.selectedText;
  const hasMessages = session.messages.length > 0 || session.isStreaming;

  return (
    <AIModeWrapper
      session={session}
      state={state}
      icon={Feather}
      title="Writing Coach"
      hideTokenBadge
      hideSettings
      headerExtra={
        selectedText && (
          <span className={styles.passageChip} title={selectedText}>
            "{selectedText.length > 40 ? selectedText.slice(0, 40) + "…" : selectedText}"
          </span>
        )
      }
    >
      {/* Tone/style chips — shown before first send */}
      {!hasMessages && selectedText && (
        <div className={styles.toneSection}>
          <p className={styles.toneLabel}>Direction (optional)</p>
          <div className={styles.chipGroup}>
            <span className={styles.chipGroupLabel}>Mood</span>
            {MOOD_PRESETS.map((tone) => (
              <button
                key={tone}
                className={`${styles.chip} ${tonePrefs.includes(tone) ? styles.chipActive : ""}`}
                onClick={() => toggleTone(tone)}
              >
                {tone}
              </button>
            ))}
          </div>
          <div className={styles.chipGroup}>
            <span className={styles.chipGroupLabel}>Style</span>
            {STYLE_PRESETS.map((tone) => (
              <button
                key={tone}
                className={`${styles.chip} ${tonePrefs.includes(tone) ? styles.chipActive : ""}`}
                onClick={() => toggleTone(tone)}
              >
                {tone}
              </button>
            ))}
          </div>
          <button
            className={styles.startBtn}
            onClick={() => {
              if (session.isStreaming) return;
              autoSentRef.current = true;
              const tones =
                tonePrefs.length > 0 ? `\n\nDirection I'm considering: ${tonePrefs.join(", ")}` : "";
              const content = `I'd like some coaching on this passage:\n\n"${selectedText}"${tones}`;
              sendMessage(session.id, content, undefined, state.sessionParams);
            }}
            disabled={session.isStreaming}
          >
            <Orbit size={13} />
            Get coaching
          </button>
        </div>
      )}

      {/* Empty state when no selected text */}
      {!hasMessages && !selectedText && (
        <div className={styles.empty}>
          <Feather size={22} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Writing Coach</p>
          <p className={styles.emptyHint}>
            Select a passage in your scene and click Writing Coach to get feedback and explore directions.
          </p>
        </div>
      )}

      {hasMessages && (
        <MessageList
          messages={session.messages}
          streamingText={session.streamingText}
          streamingThinking={session.streamingThinking}
          isStreaming={session.isStreaming}
        />
      )}

      {hasMessages && (
        <MentionComposer
          sessionId={session.id}
          value={state.input}
          onChange={state.setInput}
          onSend={() => handleSend()}
          onCancel={() => cancelStreaming(session.id)}
          disabled={session.isStreaming}
          placeholder="Continue the conversation…"
        />
      )}
    </AIModeWrapper>
  );
}
