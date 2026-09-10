import { streamAnswer } from "../../../lib/ai/eventStream";
import { useEffect, useRef, useState } from "react";
import { Archive, ChevronDown, GitFork, Compass, Loader } from "lucide-react";
import { api } from "../../../api/client";
import { useAIStore } from "../../../stores/aiStore";
import type { AISession } from "../../../stores/aiStore";
import type { ChronicleSession, ChronicleMessage } from "../../../types";
import styles from "./SessionSwitcher.module.css";
import { relativeTime } from "../../../utils/relativeTime";

function sessionLabel(s: ChronicleSession): string {
  if (s.title) return s.title;
  return s.context_label || "Session";
}

interface Props {
  session: AISession;
  onClose: () => void;
}

export default function SessionSwitcher({ session, onClose }: Props) {
  const [sessions, setSessions] = useState<ChronicleSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingTitleFor, setGeneratingTitleFor] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { resumeFromChronicle } = useAIStore();

  const storyId = session.context.storyId;
  const contextType = session.context.nodeId ? "scene" : session.context.characterId ? "character" : "story";
  const contextId = session.context.nodeId ?? session.context.characterId ?? null;

  useEffect(() => {
    if (!storyId) return;
    api
      .listChronicleSessions({
        story_id: storyId,
        context_type: contextType,
        context_id: contextId ?? undefined,
        archived: false,
        page_size: 8,
      })
      .then((res) => {
        setSessions(res.sessions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storyId, contextType, contextId]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  async function handleResume(cs: ChronicleSession) {
    onClose();
    // If already showing this session, do nothing
    if (session.chronicleSessionId === cs.id) return;
    try {
      const detail = await api.getChronicleSession(cs.id);
      const messages = detail.messages.map((m: ChronicleMessage) => ({
        role: m.role,
        content: m.content,
      }));
      await resumeFromChronicle(
        cs.id,
        cs.context_type,
        cs.context_id,
        cs.story_id,
        cs.context_label,
        messages,
      );
    } catch {
      // ignore errors
    }
  }

  async function handleArchive(e: React.MouseEvent, cs: ChronicleSession) {
    e.stopPropagation();
    try {
      await api.updateChronicleSession(cs.id, { archived: true });
      setSessions((prev) => prev.filter((s) => s.id !== cs.id));
    } catch {
      // ignore errors
    }
  }

  async function handleFork(e: React.MouseEvent, cs: ChronicleSession) {
    e.stopPropagation();
    try {
      const forked = await api.forkChronicleSession(cs.id);
      onClose();
      const detail = await api.getChronicleSession(forked.id);
      const messages = detail.messages.map((m: ChronicleMessage) => ({
        role: m.role,
        content: m.content,
      }));
      await resumeFromChronicle(
        forked.id,
        forked.context_type,
        forked.context_id,
        forked.story_id,
        forked.context_label,
        messages,
      );
    } catch {
      // ignore errors
    }
  }

  async function handleGenerateTitle(e: React.MouseEvent, cs: ChronicleSession) {
    e.stopPropagation();
    if (generatingTitleFor) return;
    setGeneratingTitleFor(cs.id);
    try {
      const res = await api.generateSessionTitle(cs.id);
      if (!res.ok || !res.body) return;
      const { text: title, error } = await streamAnswer(res);
      if (!error && title.trim()) {
        setSessions((prev) => prev.map((s) => (s.id === cs.id ? { ...s, title: title.trim() } : s)));
      }
    } catch {
      // ignore errors
    } finally {
      setGeneratingTitleFor(null);
    }
  }

  const currentChronicleId = session.chronicleSessionId;

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <div className={styles.header}>Recent sessions</div>
      {loading && <div className={styles.empty}>Loading…</div>}
      {!loading && sessions.length === 0 && <div className={styles.empty}>No saved sessions yet</div>}
      {sessions.map((cs) => (
        <div
          key={cs.id}
          className={`${styles.row} ${cs.id === currentChronicleId ? styles.active : ""}`}
          onClick={() => handleResume(cs)}
          title={sessionLabel(cs)}
        >
          <div className={styles.rowBody}>
            <span className={styles.rowTitle}>{sessionLabel(cs)}</span>
            <span className={styles.rowMeta}>
              {cs.message_count} msg · {relativeTime(cs.updated_at)}
            </span>
          </div>
          <div className={styles.rowActions}>
            {!cs.title && (
              <button
                className={styles.rowBtn}
                title="Generate title"
                onClick={(e) => handleGenerateTitle(e, cs)}
                disabled={generatingTitleFor === cs.id}
              >
                {generatingTitleFor === cs.id ? (
                  <Loader size={10} className={styles.spin} />
                ) : (
                  <Compass size={10} />
                )}
              </button>
            )}
            <button className={styles.rowBtn} title="Fork conversation" onClick={(e) => handleFork(e, cs)}>
              <GitFork size={10} />
            </button>
            <button className={styles.rowBtn} title="Archive" onClick={(e) => handleArchive(e, cs)}>
              <Archive size={10} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Trigger badge that opens/closes the switcher */
export function SessionIndicator({ session }: { session: AISession }) {
  const [open, setOpen] = useState(false);

  const contextName = session.resolvedNames.nodeName || session.resolvedNames.storyTitle || "Session";

  const hasSession = Boolean(session.chronicleSessionId);

  return (
    <div className={styles.indicatorWrap}>
      <button className={styles.indicatorBtn} onClick={() => setOpen((v) => !v)} title="Switch session">
        <span className={styles.indicatorName}>{contextName}</span>
        <span className={styles.indicatorStatus}>{hasSession ? "saved" : "new"}</span>
        <ChevronDown size={10} className={styles.chevron} />
      </button>
      {open && <SessionSwitcher session={session} onClose={() => setOpen(false)} />}
    </div>
  );
}
