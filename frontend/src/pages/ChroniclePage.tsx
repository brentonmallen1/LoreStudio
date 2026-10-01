import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import ActivityView from "../components/chronicle/ActivityView";
import ChangesView from "../components/chronicle/ChangesView";
import ConversationsView from "../components/chronicle/ConversationsView";
import JobDetail from "../components/chronicle/JobDetail";
import LogDetail from "../components/chronicle/LogDetail";
import SessionDetail from "../components/chronicle/SessionDetail";
import { itemParam, useChronicleParams } from "../components/chronicle/useChronicleParams";
import { useAIAvailable } from "../lib/mode";
import PageHeader from "../components/layout/PageHeader";
import styles from "./ChroniclePage.module.css";

type ChronicleView = "activity" | "conversations" | "changes";

const VIEWS: { id: ChronicleView; label: string; ai?: boolean; searchable: boolean }[] = [
  { id: "activity", label: "Activity", searchable: true },
  { id: "conversations", label: "Conversations", ai: true, searchable: true },
  { id: "changes", label: "Changes", searchable: false },
];

const BLURBS: Record<ChronicleView, string> = {
  activity:
    "Everything the system did for this story: AI calls, background jobs and analyses. Open a row to see exactly what was sent and what came back.",
  conversations:
    "Your chats with the AI: scene assistants, character interviews and group panels. Open one to read it back, or resume it.",
  changes:
    "Every change to this story's data, newest first. Undo here reverses the latest change from any tab; the header buttons reverse only this tab's changes.",
};

const WRITER_ACTIVITY_BLURB = "Analyses and checks run on this story. Open a row for the detail.";

/**
 * Chronicle (doc 06 §3, doc 05 §2.5): what happened in this story, and why.
 *
 * Three views instead of five tabs in a side column: Jobs moved into Activity, where a job
 * is a row that opens onto its calls, and Summaries became a filter. What is open lives in
 * the URL, so Back closes it and anything can link straight to a job or a call.
 */
export default function ChroniclePage({ section = "activity" }: { section?: string }) {
  const { storyId } = useParams<{ storyId: string }>();
  const aiAvailable = useAIAvailable();
  const { item, filter, q, update } = useChronicleParams();
  const views = VIEWS.filter((v) => aiAvailable || !v.ai);
  const view = views.find((v) => v.id === section)?.id ?? "activity";
  const searchable = views.find((v) => v.id === view)?.searchable ?? false;

  // The box updates as you type; the URL (and the query) a moment later.
  const [draft, setDraft] = useState(q);
  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    setDraft(q);
  }
  useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => update({ q: draft || null, item: null }, { replace: true }), 300);
    return () => clearTimeout(t);
  }, [draft, q, update]);

  if (!storyId) return null;

  const open = (kind: "job" | "log" | "session", id: string) => update({ item: itemParam(kind, id) });

  return (
    <div className={styles.page}>
      <PageHeader
        title={VIEWS.find((v) => v.id === view)!.label}
        summary={view === "activity" && !aiAvailable ? WRITER_ACTIVITY_BLURB : BLURBS[view]}
        aside={
          searchable && (
            <label className={styles.search}>
              <Search size={13} className={styles.searchIcon} aria-hidden />
              <input
                type="search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={view === "activity" ? "Search activity…" : "Search conversations…"}
                aria-label={view === "activity" ? "Search activity" : "Search conversations"}
              />
            </label>
          )
        }
      />

      <div className={styles.body} data-detail={item ? "open" : undefined}>
        <section className={styles.list}>
          {view === "activity" && (
            <ActivityView
              storyId={storyId}
              filter={filter}
              q={q}
              aiAvailable={aiAvailable}
              selected={item}
              onSelect={open}
              onFilter={(f) => update({ filter: f, item: null }, { replace: true })}
            />
          )}
          {view === "conversations" && (
            <ConversationsView
              storyId={storyId}
              q={q}
              selectedId={item?.kind === "session" ? item.id : null}
              onSelect={(id) => open("session", id)}
            />
          )}
          {view === "changes" && <ChangesView storyId={storyId} />}
        </section>

        {item && (
          <aside className={styles.detail} aria-label="Detail">
            <button
              type="button"
              className={styles.closeDetail}
              onClick={() => update({ item: null })}
              aria-label="Close detail"
              title="Close"
            >
              <X size={14} />
            </button>
            {item.kind === "job" && <JobDetail key={item.id} jobId={item.id} />}
            {item.kind === "log" && (
              <LogDetail key={item.id} logId={item.id} onOpenJob={(id) => open("job", id)} />
            )}
            {item.kind === "session" && <SessionDetail key={item.id} sessionId={item.id} />}
          </aside>
        )}
      </div>
    </div>
  );
}
