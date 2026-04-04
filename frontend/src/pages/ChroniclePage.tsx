import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Search, MessageSquare, Activity, ChevronLeft, Trash2, Archive,
  BookOpen, Users, GitBranch, Layers, Clock, RotateCcw,
} from "lucide-react";
import { api } from "../api/client";
import type { ChronicleSession, ChronicleSessionDetail, ActivityLog, ChronicleSearchResult } from "../types";
import styles from "./ChroniclePage.module.css";

// ── Helpers ────────────────────────────────────────────────────────────

type ViewTab = "chats" | "activity" | "search";

const CONTEXT_ICONS: Record<string, React.ReactNode> = {
  scene: <BookOpen size={12} />,
  character: <Users size={12} />,
  story: <Layers size={12} />,
  panel: <GitBranch size={12} />,
};

const CONTEXT_LABELS: Record<string, string> = {
  scene: "Scene",
  character: "Character",
  story: "Story",
  panel: "Group Interview",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function sessionTitle(s: ChronicleSession): string {
  if (s.title) return s.title;
  const label = CONTEXT_LABELS[s.context_type] ?? s.context_type;
  return s.context_label ? `${label}: ${s.context_label}` : label;
}

// ── Session card ───────────────────────────────────────────────────────

function SessionCard({
  session,
  onClick,
  onArchive,
  onDelete,
}: {
  session: ChronicleSession;
  onClick: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.cardIcon}>{CONTEXT_ICONS[session.context_type] ?? <MessageSquare size={12} />}</div>
      <div className={styles.cardBody}>
        <p className={styles.cardTitle}>{sessionTitle(session)}</p>
        <p className={styles.cardMeta}>
          {session.message_count} {session.message_count === 1 ? "message" : "messages"}
          {" · "}
          {relativeTime(session.updated_at)}
        </p>
      </div>
      <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
        <button className={styles.iconBtn} title="Archive" onClick={onArchive}><Archive size={13} /></button>
        <button className={`${styles.iconBtn} ${styles.danger}`} title="Delete" onClick={onDelete}><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

// ── Activity log card ──────────────────────────────────────────────────

function LogCard({ log }: { log: ActivityLog }) {
  const categoryColor: Record<string, string> = {
    ai: "var(--color-accent)",
    system: "var(--color-text-subtle)",
    task: "var(--segment-chapter)",
  };
  return (
    <div className={`${styles.card} ${styles.logCard}`}>
      <div className={styles.cardIcon}>
        <Activity size={12} style={{ color: categoryColor[log.category] ?? "var(--color-text-subtle)" }} />
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardTitle}>{log.description}</p>
        <p className={styles.cardMeta}>
          <span className={styles.badge}>{log.event_type}</span>
          {" · "}
          {relativeTime(log.created_at)}
        </p>
      </div>
    </div>
  );
}

// ── Session detail view ────────────────────────────────────────────────

function SessionDetail({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<ChronicleSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getChronicleSession(sessionId)
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <div className={styles.empty}>Loading…</div>;
  if (!detail) return <div className={styles.empty}>Session not found.</div>;

  return (
    <div className={styles.detail}>
      <div className={styles.detailHeader}>
        <button className={styles.backBtn} onClick={onBack}>
          <ChevronLeft size={14} /> Back
        </button>
        <div className={styles.detailMeta}>
          <span className={styles.detailTitle}>{sessionTitle(detail)}</span>
          <span className={styles.cardMeta}>{detail.message_count} messages · {relativeTime(detail.updated_at)}</span>
        </div>
      </div>

      <div className={styles.messages}>
        {detail.messages.length === 0 && (
          <p className={styles.empty}>No messages in this session.</p>
        )}
        {detail.messages.map((msg) => (
          <div key={msg.id} className={`${styles.message} ${msg.role === "user" ? styles.userMsg : styles.assistantMsg}`}>
            <p className={styles.msgRole}>{msg.role === "user" ? "You" : "Assistant"}</p>
            <p className={styles.msgContent}>{msg.content}</p>
            <div className={styles.msgFooter}>
              <span className={styles.msgTime}>{relativeTime(msg.created_at)}</span>
              {msg.model && <span className={styles.msgModel}>{msg.model}</span>}
              {msg.tokens_in != null && (
                <span className={styles.msgTokens}>{msg.tokens_in}↑ {msg.tokens_out}↓ tokens</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────

export default function ChroniclePage() {
  const { storyId } = useParams<{ storyId: string }>();

  const [tab, setTab] = useState<ViewTab>("chats");
  const [sessions, setSessions] = useState<ChronicleSession[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [searchResults, setSearchResults] = useState<ChronicleSearchResult[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSessions = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.listChronicleSessions({
        story_id: storyId,
        context_type: filterType || undefined,
        archived: showArchived,
        page: p,
        page_size: 20,
      });
      setSessions(p === 1 ? res.sessions : (prev) => [...prev, ...res.sessions]);
      setTotalSessions(res.total);
    } finally {
      setLoading(false);
    }
  }, [storyId, filterType, showArchived]);

  const loadLogs = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.listActivityLogs({ story_id: storyId, page: p, page_size: 50 });
      setLogs(p === 1 ? res.logs : (prev) => [...prev, ...res.logs]);
      setTotalLogs(res.total);
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setLoading(true);
    try {
      const res = await api.searchChronicle({ q, story_id: storyId });
      setSearchResults(res.results);
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  // Initial + filter-change loads
  useEffect(() => {
    setPage(1);
    if (tab === "chats") loadSessions(1);
    else if (tab === "activity") loadLogs(1);
  }, [tab, filterType, showArchived, loadSessions, loadLogs]);

  // Debounced search
  useEffect(() => {
    if (tab !== "search") return;
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => runSearch(searchQuery), 350);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [searchQuery, tab, runSearch]);

  async function archiveSession(id: string) {
    await api.updateChronicleSession(id, { archived: true });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setTotalSessions((n) => n - 1);
  }

  async function deleteSession(id: string) {
    await api.deleteChronicleSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setTotalSessions((n) => n - 1);
  }

  function loadMore() {
    const next = page + 1;
    setPage(next);
    if (tab === "chats") loadSessions(next);
    else if (tab === "activity") loadLogs(next);
  }

  const hasMore = tab === "chats"
    ? sessions.length < totalSessions
    : logs.length < totalLogs;

  if (selectedSessionId) {
    return (
      <div className={styles.page}>
        <SessionDetail
          sessionId={selectedSessionId}
          onBack={() => setSelectedSessionId(null)}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Chronicle</h2>
          <p className={styles.subtitle}>AI conversation history, activity logs, and system audit trail</p>
        </div>
        <div className={styles.searchWrap}>
          <Search size={13} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search conversations and logs…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value) setTab("search");
              else setTab("chats");
            }}
          />
        </div>
      </div>

      <div className={styles.body}>
        {/* ── Filters sidebar ── */}
        <aside className={styles.filters}>
          <p className={styles.filterLabel}>View</p>
          {(["chats", "activity"] as ViewTab[]).map((t) => (
            <button
              key={t}
              className={`${styles.filterBtn} ${tab === t ? styles.activeFilter : ""}`}
              onClick={() => { setTab(t); setSearchQuery(""); }}
            >
              {t === "chats" ? <MessageSquare size={12} /> : <Activity size={12} />}
              {t === "chats" ? "Conversations" : "Activity"}
            </button>
          ))}

          {tab === "chats" && (
            <>
              <p className={styles.filterLabel} style={{ marginTop: "1rem" }}>Type</p>
              {["", "scene", "character", "story", "panel"].map((type) => (
                <button
                  key={type}
                  className={`${styles.filterBtn} ${filterType === type ? styles.activeFilter : ""}`}
                  onClick={() => setFilterType(type)}
                >
                  {type === "" ? "All" : CONTEXT_LABELS[type]}
                </button>
              ))}

              <label className={styles.archiveToggle}>
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                Show archived
              </label>
            </>
          )}
        </aside>

        {/* ── Results ── */}
        <div className={styles.results}>
          {/* Chats tab */}
          {tab === "chats" && (
            <>
              {sessions.length === 0 && !loading && (
                <p className={styles.empty}>No conversations yet. Start a scene or character chat to see history here.</p>
              )}
              {sessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onClick={() => setSelectedSessionId(s.id)}
                  onArchive={() => archiveSession(s.id)}
                  onDelete={() => deleteSession(s.id)}
                />
              ))}
            </>
          )}

          {/* Activity tab */}
          {tab === "activity" && (
            <>
              {logs.length === 0 && !loading && (
                <p className={styles.empty}>No activity logged yet.</p>
              )}
              {logs.map((log) => <LogCard key={log.id} log={log} />)}
            </>
          )}

          {/* Search tab */}
          {tab === "search" && (
            <>
              {!searchQuery && <p className={styles.empty}>Type to search across conversations and activity.</p>}
              {searchQuery && !loading && searchResults.length === 0 && (
                <p className={styles.empty}>No results for "{searchQuery}".</p>
              )}
              {searchResults.map((r, i) =>
                r.type === "session" && r.session ? (
                  <div key={i}>
                    <SessionCard
                      session={r.session}
                      onClick={() => setSelectedSessionId(r.session!.id)}
                      onArchive={() => archiveSession(r.session!.id)}
                      onDelete={() => deleteSession(r.session!.id)}
                    />
                    {r.excerpt && <p className={styles.excerpt}>…{r.excerpt}…</p>}
                  </div>
                ) : r.log ? (
                  <LogCard key={i} log={r.log} />
                ) : null
              )}
            </>
          )}

          {/* Load more */}
          {(tab === "chats" || tab === "activity") && hasMore && (
            <button className={styles.loadMore} onClick={loadMore} disabled={loading}>
              {loading ? <RotateCcw size={13} className={styles.spin} /> : <Clock size={13} />}
              Load more
            </button>
          )}

          {loading && sessions.length === 0 && logs.length === 0 && (
            <p className={styles.empty}>Loading…</p>
          )}
        </div>
      </div>
    </div>
  );
}
