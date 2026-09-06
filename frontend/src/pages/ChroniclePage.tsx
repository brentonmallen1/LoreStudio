import { useEffect, useState, useCallback, useRef } from "react";
import { aiFeatureLabel } from "../lib/ai/features.generated";
import { useParams, useNavigate } from "react-router-dom";
import {
  Search,
  MessageSquare,
  Activity,
  ChevronLeft,
  Trash2,
  Archive,
  BookOpen,
  Users,
  GitBranch,
  Layers,
  Clock,
  RotateCcw,
  CheckSquare,
  Square,
  X,
  Star,
  Feather,
} from "lucide-react";
import { api } from "../api/client";
import { useAIStore } from "../stores/aiStore";
import type {
  ChronicleSession,
  ChronicleSessionDetail,
  ActivityLog,
  ChronicleSearchResult,
  ChronicleMessage,
} from "../types";
import ChangesView from "../components/chronicle/ChangesView";
import ChronicleTabs from "../components/chronicle/ChronicleTabs";
import styles from "./ChroniclePage.module.css";

// ── Helpers ────────────────────────────────────────────────────────────

import type { ViewTab } from "../components/chronicle/ChronicleTabs";

// Features that surface in the Summaries tab
const SUMMARY_FEATURES = [
  "story-summary",
  "scene-summary",
  "structure-summary",
  "interview-summary",
  "character-journey",
  "perspective-summary",
  "economy-analysis",
  "story-recap",
  "brainstorm",
].join(",");

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
  onResume,
  selected,
  onToggle,
  selectionActive,
}: {
  session: ChronicleSession;
  onClick: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onResume: () => void;
  selected: boolean;
  onToggle: () => void;
  selectionActive: boolean;
}) {
  return (
    <div
      className={`${styles.card} ${selected ? styles.selectedCard : ""}`}
      onClick={selectionActive ? onToggle : onClick}
    >
      <div
        className={`${styles.checkboxWrap} ${selectionActive ? styles.checkboxVisible : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {selected ? (
          <CheckSquare size={15} className={styles.checkboxOn} />
        ) : (
          <Square size={15} className={styles.checkboxOff} />
        )}
      </div>
      <div className={styles.cardIcon}>
        {CONTEXT_ICONS[session.context_type] ?? <MessageSquare size={12} />}
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardTitle}>{sessionTitle(session)}</p>
        {session.last_message_preview && <p className={styles.cardPreview}>{session.last_message_preview}</p>}
        <p className={styles.cardMeta}>
          {session.message_count} {session.message_count === 1 ? "message" : "messages"}
          {" · "}
          {relativeTime(session.updated_at)}
        </p>
      </div>
      <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
        <button className={`${styles.iconBtn} ${styles.ai}`} title="Resume in AI panel" onClick={onResume}>
          <Feather size={13} />
        </button>
        <button className={styles.iconBtn} title="Archive" onClick={onArchive}>
          <Archive size={13} />
        </button>
        <button className={`${styles.iconBtn} ${styles.danger}`} title="Delete" onClick={onDelete}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Activity log card ──────────────────────────────────────────────────

function featureLabel(log: ActivityLog): string {
  const feature = log.metadata_?.feature as string | undefined;
  // Labels come from the backend feature table (lib/ai/features.generated.ts). Rows
  // written before a feature was renamed fall back to the event type.
  if (feature) return aiFeatureLabel(feature);
  return log.event_type
    .replace(/^ai_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function LogCard({
  log,
  onStarToggle,
}: {
  log: ActivityLog;
  onStarToggle?: (id: string, starred: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [starring, setStarring] = useState(false);
  const categoryColor: Record<string, string> = {
    ai: "var(--color-accent)",
    system: "var(--color-text-subtle)",
    task: "var(--segment-chapter)",
  };
  const prompt = log.metadata_?.prompt as string | undefined;
  const response = log.metadata_?.response as string | undefined;
  const model = log.metadata_?.model as string | undefined;
  const tokensIn = log.metadata_?.tokens_in as number | undefined;
  const tokensOut = log.metadata_?.tokens_out as number | undefined;
  const hasContent = !!(prompt || response);

  // Strip thinking blocks from response preview
  const responsePreview = response?.replace(/<\|channel>thought\n[\s\S]*?<channel\|>/g, "").trim();

  async function toggleStar(e: React.MouseEvent) {
    e.stopPropagation();
    if (starring) return;
    setStarring(true);
    try {
      await api.updateActivityLog(log.id, { starred: !log.starred });
      onStarToggle?.(log.id, !log.starred);
    } finally {
      setStarring(false);
    }
  }

  return (
    <div
      className={`${styles.card} ${styles.logCard} ${hasContent ? styles.logCardExpandable : ""}`}
      onClick={() => hasContent && setExpanded((v) => !v)}
    >
      <div className={styles.cardIcon}>
        <Activity size={12} style={{ color: categoryColor[log.category] ?? "var(--color-text-subtle)" }} />
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardTitle}>{featureLabel(log)}</p>
        {prompt && <p className={`${styles.cardPreview} ${styles.logPromptPreview}`}>{prompt}</p>}
        {responsePreview && <p className={styles.cardPreview}>{responsePreview}</p>}
        <p className={styles.cardMeta}>
          {model && <span className={styles.badge}>{model}</span>}
          {tokensIn != null && (
            <span>
              {tokensIn}↑ {tokensOut}↓ tokens
            </span>
          )}
          {" · "}
          {relativeTime(log.created_at)}
        </p>
      </div>
      <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
        <button
          className={`${styles.iconBtn} ${log.starred ? styles.starActive : ""}`}
          title={log.starred ? "Unstar" : "Star this summary"}
          onClick={toggleStar}
          disabled={starring}
        >
          <Star size={13} />
        </button>
      </div>
      {expanded && (
        <div className={styles.logDetail}>
          {prompt && (
            <div className={styles.logMessage}>
              <span className={styles.logRole}>You</span>
              <p className={styles.logContent}>{prompt}</p>
            </div>
          )}
          {response && (
            <div className={styles.logMessage}>
              <span className={styles.logRole}>AI</span>
              <p className={styles.logContent}>{responsePreview}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Session detail view ────────────────────────────────────────────────

function SessionDetail({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<ChronicleSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getChronicleSession(sessionId)
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
          <span className={styles.cardMeta}>
            {detail.message_count} messages · {relativeTime(detail.updated_at)}
          </span>
        </div>
      </div>

      <div className={styles.messages}>
        {detail.messages.length === 0 && <p className={styles.empty}>No messages in this session.</p>}
        {detail.messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${msg.role === "user" ? styles.userMsg : styles.assistantMsg}`}
          >
            <p className={styles.msgRole}>{msg.role === "user" ? "You" : "Assistant"}</p>
            <p className={styles.msgContent}>{msg.content}</p>
            <div className={styles.msgFooter}>
              <span className={styles.msgTime}>{relativeTime(msg.created_at)}</span>
              {msg.model && <span className={styles.msgModel}>{msg.model}</span>}
              {msg.tokens_in != null && (
                <span className={styles.msgTokens}>
                  {msg.tokens_in}↑ {msg.tokens_out}↓ tokens
                </span>
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
  const navigate = useNavigate();
  const { resumeFromChronicle } = useAIStore();

  const [tab, setTab] = useState<ViewTab>("chats");
  const [sessions, setSessions] = useState<ChronicleSession[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [summaries, setSummaries] = useState<ActivityLog[]>([]);
  const [searchResults, setSearchResults] = useState<ChronicleSearchResult[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalSummaries, setTotalSummaries] = useState(0);
  const [starredOnly, setStarredOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSessions = useCallback(
    async (p = 1) => {
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
    },
    [storyId, filterType, showArchived],
  );

  const loadLogs = useCallback(
    async (p = 1) => {
      setLoading(true);
      try {
        const res = await api.listActivityLogs({ story_id: storyId, page: p, page_size: 50 });
        setLogs(p === 1 ? res.logs : (prev) => [...prev, ...res.logs]);
        setTotalLogs(res.total);
      } finally {
        setLoading(false);
      }
    },
    [storyId],
  );

  const loadSummaries = useCallback(
    async (p = 1) => {
      setLoading(true);
      try {
        const res = await api.listActivityLogs({
          story_id: storyId,
          features: SUMMARY_FEATURES,
          starred: starredOnly ? true : undefined,
          page: p,
          page_size: 50,
        });
        setSummaries(p === 1 ? res.logs : (prev) => [...prev, ...res.logs]);
        setTotalSummaries(res.total);
      } finally {
        setLoading(false);
      }
    },
    [storyId, starredOnly],
  );

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setSearchResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await api.searchChronicle({ q, story_id: storyId });
        setSearchResults(res.results);
      } finally {
        setLoading(false);
      }
    },
    [storyId],
  );

  // Initial + filter-change loads; clear selection on context change
  useEffect(() => {
    setPage(1);
    clearSelection();
    if (tab === "chats") loadSessions(1);
    else if (tab === "activity") loadLogs(1);
    else if (tab === "summaries") loadSummaries(1);
  }, [tab, filterType, showArchived, starredOnly, loadSessions, loadLogs, loadSummaries]);

  // Debounced search
  useEffect(() => {
    if (tab !== "search") return;
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => runSearch(searchQuery), 350);
    return () => {
      if (searchRef.current) clearTimeout(searchRef.current);
    };
  }, [searchQuery, tab, runSearch]);

  async function archiveSession(id: string) {
    await api.updateChronicleSession(id, { archived: true });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setTotalSessions((n) => n - 1);
  }

  async function handleResume(s: ChronicleSession) {
    try {
      const detail = await api.getChronicleSession(s.id);
      const messages = detail.messages.map((m: ChronicleMessage) => ({
        role: m.role,
        content: m.content,
      }));
      await resumeFromChronicle(s.id, s.context_type, s.context_id, s.story_id, s.context_label, messages);
      navigate(`/stories/${s.story_id}`);
    } catch {
      // ignore errors
    }
  }

  async function deleteSession(id: string) {
    await api.deleteChronicleSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setTotalSessions((n) => n - 1);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(sessions.map((s) => s.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function bulkArchive() {
    setBulkWorking(true);
    await Promise.all([...selectedIds].map((id) => api.updateChronicleSession(id, { archived: true })));
    setSessions((prev) => prev.filter((s) => !selectedIds.has(s.id)));
    setTotalSessions((n) => n - selectedIds.size);
    clearSelection();
    setBulkWorking(false);
  }

  async function bulkDelete() {
    setBulkWorking(true);
    await Promise.all([...selectedIds].map((id) => api.deleteChronicleSession(id)));
    setSessions((prev) => prev.filter((s) => !selectedIds.has(s.id)));
    setTotalSessions((n) => n - selectedIds.size);
    clearSelection();
    setBulkWorking(false);
  }

  function handleStarToggle(id: string, starred: boolean) {
    const update = (item: ActivityLog) => (item.id === id ? { ...item, starred } : item);
    setLogs((prev) => prev.map(update));
    setSummaries((prev) => {
      const updated = prev.map(update);
      // If showing starred only and we just unstarred, remove from list
      return starredOnly ? updated.filter((l) => l.starred) : updated;
    });
  }

  function loadMore() {
    const next = page + 1;
    setPage(next);
    if (tab === "chats") loadSessions(next);
    else if (tab === "activity") loadLogs(next);
    else if (tab === "summaries") loadSummaries(next);
  }

  const hasMore =
    tab === "chats"
      ? sessions.length < totalSessions
      : tab === "summaries"
        ? summaries.length < totalSummaries
        : logs.length < totalLogs;

  if (selectedSessionId) {
    return (
      <div className={styles.page}>
        <SessionDetail sessionId={selectedSessionId} onBack={() => setSelectedSessionId(null)} />
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
          <ChronicleTabs
            tab={tab}
            counts={{ chats: totalSessions, activity: totalLogs, summaries: totalSummaries }}
            onSelect={(t) => {
              setTab(t);
              setSearchQuery("");
            }}
          />

          {tab === "summaries" && (
            <>
              <p className={styles.filterLabel} style={{ marginTop: "1rem" }}>
                Filter
              </p>
              <label className={styles.archiveToggle}>
                <input
                  type="checkbox"
                  checked={starredOnly}
                  onChange={(e) => setStarredOnly(e.target.checked)}
                />
                Starred only
              </label>
            </>
          )}

          {tab === "chats" && (
            <>
              <p className={styles.filterLabel} style={{ marginTop: "1rem" }}>
                Type
              </p>
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
          {/* Tab blurbs */}
          {tab === "chats" && (
            <p className={styles.tabBlurb}>
              Conversations are direct back-and-forth chats with the AI — scene assistants, character
              interviews, and group panels. Each session is tied to a specific context and can be resumed.
            </p>
          )}
          {tab === "changes" && storyId && <ChangesView storyId={storyId} />}
          {tab === "activity" && (
            <p className={styles.tabBlurb}>
              Activity logs every task the AI executes on your behalf — generating suggestions, summarizing
              scenes, analyzing perspectives, and other background operations. Click any entry to see the full
              prompt and response.
            </p>
          )}

          {/* Chats tab */}
          {tab === "chats" && (
            <>
              {selectedIds.size > 0 && (
                <div className={styles.bulkBar}>
                  <span className={styles.bulkCount}>{selectedIds.size} selected</span>
                  <button className={styles.bulkBtn} onClick={selectAll} disabled={bulkWorking}>
                    <CheckSquare size={13} /> Select all ({sessions.length})
                  </button>
                  <button className={styles.bulkBtn} onClick={bulkArchive} disabled={bulkWorking}>
                    <Archive size={13} /> Archive
                  </button>
                  <button
                    className={`${styles.bulkBtn} ${styles.bulkDanger}`}
                    onClick={bulkDelete}
                    disabled={bulkWorking}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                  <button
                    className={styles.bulkClear}
                    onClick={clearSelection}
                    disabled={bulkWorking}
                    title="Clear selection"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              {sessions.length === 0 && !loading && (
                <p className={styles.empty}>
                  No conversations yet. Start a scene or character chat to see history here.
                </p>
              )}
              {sessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onClick={() => setSelectedSessionId(s.id)}
                  onArchive={() => archiveSession(s.id)}
                  onDelete={() => deleteSession(s.id)}
                  onResume={() => handleResume(s)}
                  selected={selectedIds.has(s.id)}
                  onToggle={() => toggleSelect(s.id)}
                  selectionActive={selectedIds.size > 0}
                />
              ))}
            </>
          )}

          {/* Activity tab */}
          {tab === "activity" && (
            <>
              {logs.length === 0 && !loading && <p className={styles.empty}>No activity logged yet.</p>}
              {logs.map((log) => (
                <LogCard key={log.id} log={log} onStarToggle={handleStarToggle} />
              ))}
            </>
          )}

          {/* Summaries tab */}
          {tab === "summaries" && (
            <>
              <p className={styles.tabBlurb}>
                All AI-generated summaries, analyses, and brainstorms — scene summaries, story recaps,
                character journeys, perspective summaries, and more. Star important ones to pin them for quick
                access.
              </p>
              {summaries.length === 0 && !loading && (
                <p className={styles.empty}>
                  {starredOnly
                    ? "No starred summaries yet. Star a summary from the Activity log or here to pin it."
                    : "No summaries yet. Generate a scene summary, story recap, or perspective summary to see it here."}
                </p>
              )}
              {summaries.map((log) => (
                <LogCard key={log.id} log={log} onStarToggle={handleStarToggle} />
              ))}
            </>
          )}

          {/* Search tab */}
          {tab === "search" && (
            <>
              {!searchQuery && (
                <p className={styles.empty}>Type to search across conversations and activity.</p>
              )}
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
                      onResume={() => handleResume(r.session!)}
                      selected={false}
                      onToggle={() => {}}
                      selectionActive={false}
                    />
                    {r.excerpt && <p className={styles.excerpt}>…{r.excerpt}…</p>}
                  </div>
                ) : r.log ? (
                  <LogCard key={i} log={r.log} />
                ) : null,
              )}
            </>
          )}

          {/* Load more */}
          {(tab === "chats" || tab === "activity" || tab === "summaries") && hasMore && (
            <button className={styles.loadMore} onClick={loadMore} disabled={loading}>
              {loading ? <RotateCcw size={13} className={styles.spin} /> : <Clock size={13} />}
              Load more
            </button>
          )}

          {loading && sessions.length === 0 && logs.length === 0 && <p className={styles.empty}>Loading…</p>}
        </div>
      </div>
    </div>
  );
}
