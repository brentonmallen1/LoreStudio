import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Send, Users } from "lucide-react";
import { api } from "../../api/client";
import { useStoryStore } from "../../stores/storyStore";
import type { PanelInterview, PanelInterviewSummary } from "../../types";
import CreatePanelDialog from "./CreatePanelDialog";
import styles from "./PanelInterviewPanel.module.css";

interface Props {
  storyId: string;
}

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
  // Split on [Name]: pattern
  const blocks: { name: string; text: string }[] = [];
  const regex = /\[([^\]]+)\]:\s*/g;
  let lastIndex = 0;
  let lastMatch: RegExpExecArray | null = null;

  let match;
  while ((match = regex.exec(content)) !== null) {
    if (lastMatch) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) {
        blocks.push({ name: lastMatch[1], text });
      }
    }
    lastMatch = match;
    lastIndex = regex.lastIndex;
  }
  if (lastMatch) {
    const text = content.slice(lastIndex).trim();
    if (text) {
      blocks.push({ name: lastMatch[1], text });
    }
  }
  if (blocks.length === 0 && content.trim()) {
    blocks.push({ name: "", text: content.trim() });
  }
  return blocks;
}

export default function PanelInterviewPanel({ storyId }: Props) {
  const { characters } = useStoryStore();
  const [panels, setPanels] = useState<PanelInterviewSummary[]>([]);
  const [activePanel, setActivePanel] = useState<PanelInterview | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [inputText, setInputText] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.listPanels(storyId).then(setPanels).catch(() => {});
  }, [storyId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activePanel?.messages, streamingText]);

  function charColor(name: string): string {
    const idx = (activePanel?.character_ids ?? []).findIndex((id) => {
      const c = characters.find((x) => x.id === id);
      return c?.name === name;
    });
    return CHAR_COLORS[Math.max(0, idx) % CHAR_COLORS.length];
  }

  async function openPanel(id: string) {
    try {
      const panel = await api.getPanel(id);
      setActivePanel(panel);
    } catch {}
  }

  async function handleCreated(panel: PanelInterview) {
    setShowCreate(false);
    setActivePanel(panel);
    const summaries = await api.listPanels(storyId);
    setPanels(summaries);
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this group interview?")) return;
    await api.deletePanel(id);
    setPanels((prev) => prev.filter((p) => p.id !== id));
    if (activePanel?.id === id) setActivePanel(null);
  }

  async function handleSend() {
    if (!activePanel || !inputText.trim() || sending) return;
    const content = inputText.trim();
    setInputText("");
    setSending(true);
    setStreamingText("");

    // Optimistically add user message to UI
    setActivePanel((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [
          ...prev.messages,
          { role: "user", content, timestamp: new Date().toISOString() },
        ],
      };
    });

    try {
      const res = await api.sendPanelMessage(activePanel.id, content);
      if (!res.ok || !res.body) throw new Error("Failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setStreamingText(full);
      }
      // Commit streamed message
      setActivePanel((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [
            ...prev.messages,
            { role: "panel", content: full, timestamp: new Date().toISOString() },
          ],
        };
      });
      setStreamingText("");
    } catch {
      setStreamingText("");
    } finally {
      setSending(false);
    }
  }

  const panelCharacterNames = (panel: PanelInterviewSummary) =>
    panel.character_ids
      .map((id) => characters.find((c) => c.id === id)?.name ?? "?")
      .join(", ");

  return (
    <div className={styles.page}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>Group Interviews</span>
          <button onClick={() => setShowCreate(true)} className={styles.newBtn} aria-label="New panel">
            <Plus size={13} />
          </button>
        </div>
        <div className={styles.panelList}>
          {panels.length === 0 && (
            <p className={styles.emptyHint}>No group interviews yet.</p>
          )}
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
              <button
                className={styles.deleteBtn}
                onClick={(e) => handleDelete(p.id, e)}
                aria-label="Delete panel"
              >
                <Trash2 size={11} />
              </button>
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
            </div>

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
                const blocks = parsePanelResponse(msg.content);
                return (
                  <div key={i} className={styles.panelMsg}>
                    {blocks.map((b, j) => (
                      <div key={j} className={styles.charBlock}>
                        {b.name && (
                          <span
                            className={styles.charName}
                            style={{ color: charColor(b.name) }}
                          >
                            {b.name}
                          </span>
                        )}
                        <p className={styles.charText}>{b.text}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
              {streamingText && (
                <div className={styles.panelMsg}>
                  {parsePanelResponse(streamingText).map((b, j) => (
                    <div key={j} className={styles.charBlock}>
                      {b.name && (
                        <span
                          className={styles.charName}
                          style={{ color: charColor(b.name) }}
                        >
                          {b.name}
                        </span>
                      )}
                      <p className={styles.charText}>{b.text}</p>
                    </div>
                  ))}
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
              <button
                onClick={handleSend}
                disabled={sending || !inputText.trim()}
                className={styles.sendBtn}
                aria-label="Send"
              >
                <Send size={14} />
              </button>
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
  );
}
