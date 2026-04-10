import { useState, useEffect, useRef } from "react";
import { Users } from "lucide-react";
import { api } from "../../../api/client";
import { useAIStore } from "../../../stores/aiStore";
import { useStoryStore } from "../../../stores/storyStore";
import type { AISession } from "../../../stores/aiStore";
import { useAIModeState } from "../../../hooks/useAIModeState";
import AIModeWrapper from "../AIModeWrapper";
import ChatInput from "../shared/ChatInput";
import styles from "./PanelMode.module.css";

// Palette for distinguishing characters by color
const CHAR_COLORS = [
  "var(--color-accent)",
  "#e8854a",
  "#4aae8c",
  "#c45fc4",
  "#5f9ce8",
  "#c4b44a",
];

function parsePanelResponse(content: string): { name: string; text: string }[] {
  const blocks: { name: string; text: string }[] = [];
  const regex = /\[([^\]]+)\]:\s*/g;
  let lastIndex = 0;
  let lastMatch: RegExpExecArray | null = null;

  let match;
  while ((match = regex.exec(content)) !== null) {
    if (lastMatch) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) blocks.push({ name: lastMatch[1], text });
    }
    lastMatch = match;
    lastIndex = regex.lastIndex;
  }
  if (lastMatch) {
    const text = content.slice(lastIndex).trim();
    if (text) blocks.push({ name: lastMatch[1], text });
  }
  if (blocks.length === 0 && content.trim()) {
    blocks.push({ name: "", text: content.trim() });
  }
  return blocks;
}

interface Props {
  session: AISession;
}

export default function PanelMode({ session }: Props) {
  const state = useAIModeState(session);
  const { sendMessage, cancelStreaming, _setBackendSessionId, updateSessionContext } = useAIStore();
  const { characters } = useStoryStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const storyId = session.context.storyId ?? "";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages, session.streamingText]);

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
      // Keep setup UI visible on error
    } finally {
      setCreating(false);
    }
  }

  function toggleChar(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function charColor(name: string): string {
    const charIds = session.context.characterIds ?? selectedIds;
    const idx = charIds.findIndex((id) => {
      const c = characters.find((x) => x.id === id);
      return c?.name === name;
    });
    return CHAR_COLORS[Math.max(0, idx) % CHAR_COLORS.length];
  }

  function handleSend() {
    if (!state.input.trim() || session.isStreaming || !session.backendSessionId) return;
    state.lastUserMsg.current = state.input.trim();
    sendMessage(session.id, state.input.trim(), undefined, state.sessionParams);
    state.setInput("");
  }

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
          <p className={styles.setupHint}>
            Select two or more characters to interview together.
          </p>
          {characters.length === 0 ? (
            <p className={styles.setupEmpty}>No characters found in this story.</p>
          ) : (
            <div className={styles.charGrid}>
              {characters.map((c, i) => (
                <button
                  key={c.id}
                  className={`${styles.charChip} ${selectedIds.includes(c.id) ? styles.charChipSelected : ""}`}
                  onClick={() => toggleChar(c.id)}
                  style={selectedIds.includes(c.id) ? { borderColor: CHAR_COLORS[i % CHAR_COLORS.length], color: CHAR_COLORS[i % CHAR_COLORS.length] } : {}}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <button
            className={styles.createBtn}
            onClick={handleCreate}
            disabled={selectedIds.length < 2 || creating || !storyId}
          >
            {creating ? "Creating…" : `Start panel (${selectedIds.length} selected)`}
          </button>
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
    >
      <div className={styles.messages}>
        {session.messages.length === 0 && !session.isStreaming && (
          <div className={styles.emptyMsg}>
            <p>Ask the panel something to begin.</p>
          </div>
        )}
        {session.messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} className={styles.userMsg}>
                <span className={styles.userLabel}>You</span>
                <p className={styles.userText}>{msg.content}</p>
              </div>
            );
          }
          const blocks = parsePanelResponse(msg.content);
          return (
            <div key={i} className={styles.panelMsg}>
              {blocks.map((b, j) => (
                <div key={j} className={styles.charBlock}>
                  {b.name && (
                    <span className={styles.charName} style={{ color: charColor(b.name) }}>
                      {b.name}
                    </span>
                  )}
                  <p className={styles.charText}>{b.text}</p>
                </div>
              ))}
            </div>
          );
        })}
        {session.streamingText && (
          <div className={styles.panelMsg}>
            {parsePanelResponse(session.streamingText).map((b, j) => (
              <div key={j} className={styles.charBlock}>
                {b.name && (
                  <span className={styles.charName} style={{ color: charColor(b.name) }}>
                    {b.name}
                  </span>
                )}
                <p className={styles.charText}>{b.text}</p>
              </div>
            ))}
          </div>
        )}
        {session.isStreaming && !session.streamingText && (
          <div className={styles.thinking}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput
        value={state.input}
        onChange={state.setInput}
        onSend={handleSend}
        onCancel={() => cancelStreaming(session.id)}
        disabled={session.isStreaming}
        placeholder="Ask the panel something…"
      />
    </AIModeWrapper>
  );
}
