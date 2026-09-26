import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  BookOpen,
  CheckSquare,
  Clock,
  Feather,
  GitBranch,
  Layers,
  MessageSquare,
  Square,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { api } from "../../api/client";
import type { ChronicleSession } from "../../types";
import { relativeTime } from "../../utils/relativeTime";
import AIOnly from "../ai/AIOnly";
import { CONTEXT_LABELS, sessionTitle, useResumeSession } from "./sessions";
import styles from "./Conversations.module.css";
import timeline from "./Timeline.module.css";

const CONTEXT_ICONS: Record<string, React.ReactNode> = {
  scene: <BookOpen size={12} />,
  character: <Users size={12} />,
  story: <Layers size={12} />,
  panel: <GitBranch size={12} />,
};

const TYPES = ["", "scene", "character", "story", "panel"];
const PAGE = 20;

interface Props {
  storyId: string;
  q: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Chronicle › Conversations: chats with the AI, read back, resumed, archived. */
export default function ConversationsView({ storyId, q, selectedId, onSelect }: Props) {
  const [sessions, setSessions] = useState<ChronicleSession[] | null>(null);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [type, setType] = useState("");
  const [archived, setArchived] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);
  const resume = useResumeSession();

  // Bumped to re-read the list after archiving or deleting.
  const [version, setVersion] = useState(0);

  const fetchSessions = useCallback(async (): Promise<{ sessions: ChronicleSession[]; total: number }> => {
    if (q) {
      // Search reaches into message text, which the list endpoint does not.
      const res = await api.searchChronicle({ q, story_id: storyId, page_size: 100 });
      const found = res.results.filter((r) => r.type === "session" && r.session).map((r) => r.session!);
      return { sessions: found, total: found.length };
    }
    const res = await api.listChronicleSessions({
      story_id: storyId,
      context_type: type || undefined,
      archived,
      page: 1,
      page_size: limit,
    });
    return { sessions: res.sessions, total: res.total };
  }, [storyId, q, type, archived, limit]);

  useEffect(() => {
    let live = true;
    fetchSessions()
      .then((res) => {
        if (!live) return;
        setSessions(res.sessions);
        setTotal(res.total);
      })
      .catch(() => live && setSessions((prev) => prev ?? []));
    return () => {
      live = false;
    };
  }, [fetchSessions, version]);

  async function apply(action: "archive" | "delete", ids: string[]) {
    setWorking(true);
    await Promise.all(
      ids.map((id) =>
        action === "archive"
          ? api.updateChronicleSession(id, { archived: true })
          : api.deleteChronicleSession(id),
      ),
    );
    setPicked(new Set());
    setWorking(false);
    setVersion((v) => v + 1);
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selecting = picked.size > 0;

  return (
    <>
      <div className={timeline.filters}>
        {TYPES.map((t) => (
          <button
            key={t || "all"}
            type="button"
            className={`${timeline.filter} ${type === t ? timeline.filterOn : ""}`}
            onClick={() => {
              setType(t);
              setPicked(new Set());
            }}
            disabled={!!q}
          >
            {t ? CONTEXT_LABELS[t] : "All"}
          </button>
        ))}
        <label className={styles.archivedToggle}>
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => {
              setArchived(e.target.checked);
              setPicked(new Set());
            }}
            disabled={!!q}
          />
          Archived
        </label>
        {sessions && (
          <span className={timeline.count}>
            {total} {total === 1 ? "conversation" : "conversations"}
          </span>
        )}
      </div>

      {selecting && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{picked.size} selected</span>
          <button
            className={styles.bulkBtn}
            onClick={() => setPicked(new Set(sessions?.map((s) => s.id)))}
            disabled={working}
          >
            <CheckSquare size={13} /> Select all ({sessions?.length ?? 0})
          </button>
          <button className={styles.bulkBtn} onClick={() => apply("archive", [...picked])} disabled={working}>
            <Archive size={13} /> Archive
          </button>
          <button
            className={`${styles.bulkBtn} ${styles.bulkDanger}`}
            onClick={() => apply("delete", [...picked])}
            disabled={working}
          >
            <Trash2 size={13} /> Delete
          </button>
          <button className={styles.bulkClear} onClick={() => setPicked(new Set())} title="Clear selection">
            <X size={13} />
          </button>
        </div>
      )}

      {sessions === null ? (
        <p className={timeline.empty}>Loading…</p>
      ) : sessions.length === 0 ? (
        <p className={timeline.empty}>
          {q
            ? `No conversation mentions “${q}”.`
            : "No conversations yet. Talk to a character or use the scene assistant, and it will be kept here."}
        </p>
      ) : (
        <div className={timeline.rows}>
          {sessions.map((s) => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              aria-current={selectedId === s.id || undefined}
              className={`${timeline.row} ${selectedId === s.id ? timeline.rowSelected : ""}`}
              onClick={() => (selecting ? toggle(s.id) : onSelect(s.id))}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelect(s.id);
                }
              }}
            >
              <button
                type="button"
                className={`${styles.check} ${selecting ? styles.checkVisible : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(s.id);
                }}
                aria-label={`Select ${sessionTitle(s)}`}
                aria-pressed={picked.has(s.id)}
              >
                {picked.has(s.id) ? <CheckSquare size={14} /> : <Square size={14} />}
              </button>
              <span className={timeline.rowIcon}>
                {CONTEXT_ICONS[s.context_type] ?? <MessageSquare size={12} />}
              </span>
              <span className={timeline.rowMain}>
                <span className={timeline.rowTitle}>{sessionTitle(s)}</span>
                <span className={timeline.rowSummary}>{s.last_message_preview}</span>
              </span>
              <span className={timeline.rowMeta}>
                <span className={timeline.metaQuiet}>
                  {s.message_count} {s.message_count === 1 ? "message" : "messages"}
                </span>
                <span className={timeline.time}>{relativeTime(s.updated_at)}</span>
              </span>
              <span className={timeline.rowActions}>
                <AIOnly>
                  <button
                    type="button"
                    className={`${timeline.iconBtn} ${timeline.revealOnHover} ${styles.ai}`}
                    title="Resume in AI panel"
                    aria-label="Resume in AI panel"
                    onClick={(e) => {
                      e.stopPropagation();
                      resume(s);
                    }}
                  >
                    <Feather size={12} />
                  </button>
                </AIOnly>
                <button
                  type="button"
                  className={`${timeline.iconBtn} ${timeline.revealOnHover}`}
                  title="Archive"
                  aria-label="Archive"
                  onClick={(e) => {
                    e.stopPropagation();
                    apply("archive", [s.id]);
                  }}
                >
                  <Archive size={12} />
                </button>
                <button
                  type="button"
                  className={`${timeline.iconBtn} ${timeline.revealOnHover} ${styles.danger}`}
                  title="Delete"
                  aria-label="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    apply("delete", [s.id]);
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {!q && sessions && sessions.length < total && (
        <button type="button" className={timeline.loadMore} onClick={() => setLimit((n) => n + PAGE)}>
          <Clock size={13} /> Show older
        </button>
      )}
    </>
  );
}
