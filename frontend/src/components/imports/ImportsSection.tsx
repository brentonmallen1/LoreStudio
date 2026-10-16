import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download } from "lucide-react";
import { api } from "../../api/client";
import { useAIAvailable } from "../../lib/mode";
import { sectionPath } from "../../lib/routes";
import { parseServerDate } from "../../lib/serverDate";
import type { ImportReport } from "../../types/novelcrafter";
import PageHeader from "../layout/PageHeader";
import styles from "./Imports.module.css";

const SOURCES: Record<ImportReport["source"], string> = {
  novelcrafter: "Novelcrafter",
  document: "a document",
  script: "a script",
};

/** What came over, by kind: the words, and the page each opens. */
const CAME: { key: string; one: string; many: string; route?: [string, string]; ai?: boolean }[] = [
  { key: "character", one: "character", many: "characters", route: ["lorebook", "characters"] },
  { key: "location", one: "place", many: "places", route: ["lorebook", "places"] },
  { key: "thread", one: "thread", many: "threads", route: ["promises", "threads"] },
  { key: "trope", one: "trope", many: "tropes", route: ["lorebook", "identity"] },
  { key: "world_system", one: "world system", many: "world systems", route: ["lorebook", "systems"] },
  { key: "culture", one: "culture", many: "cultures", route: ["lorebook", "cultures"] },
  { key: "historical_event", one: "event", many: "events" },
  {
    key: "compendium",
    one: "Compendium entry",
    many: "Compendium entries",
    route: ["compendium", "everything"],
  },
  { key: "note", one: "note", many: "notes", route: ["compendium", "notes"] },
  {
    key: "link",
    one: "link in the Compendium",
    many: "links in the Compendium",
    route: ["compendium", "research"],
  },
  { key: "image", one: "image", many: "images", route: ["compendium", "images"] },
  {
    key: "chat_session",
    one: "AI conversation",
    many: "AI conversations",
    route: ["chronicle", "conversations"],
    ai: true,
  },
  { key: "folded", one: "piece folded into another entry", many: "pieces folded into other entries" },
];

const when = (iso: string) =>
  parseServerDate(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

/**
 * Chronicle › Imports (doc 28): every import that made this story, and for one of them what it
 * brought and where everything went: what came over, what waits in Proposals, what had no
 * place and why, what the file never had, and the original file to download.
 */
export default function ImportsSection({ storyId }: { storyId: string }) {
  const { recordId } = useParams();
  const [records, setRecords] = useState<ImportReport[] | null>(null);
  // The report shown, with the record it is for: a stale one is not drawn under a new address.
  const [loaded, setLoaded] = useState<ImportReport | null>(null);

  useEffect(() => {
    void api.listImports(storyId).then(setRecords, () => setRecords([]));
  }, [storyId]);
  useEffect(() => {
    if (recordId) void api.getImport(storyId, recordId).then(setLoaded, () => setLoaded(null));
  }, [storyId, recordId]);

  const report = recordId && loaded?.id === recordId ? loaded : null;
  const shown = report ?? (records && records.length === 1 ? records[0] : null);
  return (
    <div className={styles.page}>
      <PageHeader
        title="Imports"
        summary={
          records === null
            ? "Reading…"
            : records.length === 0
              ? "This story was not imported"
              : `${records.length} ${records.length === 1 ? "import" : "imports"}`
        }
      />
      <div className={styles.scroll}>
        <div className={styles.column}>
          {records && records.length > 1 && (
            <ul className={styles.list} aria-label="Imports">
              {records.map((r) => (
                <li key={r.id}>
                  <Link
                    to={sectionPath(storyId, "chronicle", "imports", r.id)}
                    aria-current={shown?.id === r.id || undefined}
                    className={styles.listItem}
                  >
                    {r.filename || `From ${SOURCES[r.source]}`}
                    <span className={styles.sub}>{when(r.imported_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {records && records.length === 0 && (
            <p className={styles.quiet}>
              Stories brought in through Import keep a record here: what came over, what waits for you, and
              the original file.
            </p>
          )}
          {shown && <Report storyId={storyId} report={shown} />}
        </div>
      </div>
    </div>
  );
}

function Report({ storyId, report: r }: { storyId: string; report: ImportReport }) {
  const ai = useAIAvailable();
  const came = CAME.filter((c) => (r.came_over[c.key] ?? 0) > 0 && (!c.ai || ai));
  const proposals = `/stories/${storyId}/discoveries?kind=imported`;
  return (
    <article className={styles.report} aria-label="The import's report">
      <h2 className={styles.title}>
        From {SOURCES[r.source]}, {when(r.imported_at)}
      </h2>
      <p className={styles.lead}>{r.filename}</p>

      <section className={styles.block} aria-label="Came over">
        <h3 className={styles.heading}>Came over</h3>
        <ul className={styles.facts}>
          <li>
            The manuscript: {r.scenes} {r.scenes === 1 ? "part" : "parts"}
          </li>
          {came.map((c) => {
            const n = r.came_over[c.key];
            const words = `${n} ${n === 1 ? c.one : c.many}`;
            return (
              <li key={c.key}>
                {c.route ? <Link to={sectionPath(storyId, c.route[0], c.route[1])}>{words}</Link> : words}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.block} aria-label="Waiting for you">
        <h3 className={styles.heading}>Waiting for you</h3>
        {r.waiting > 0 ? (
          <p className={styles.text}>
            {r.waiting} {r.waiting === 1 ? "piece has" : "pieces have"} no home yet.{" "}
            <Link to={proposals}>Sort them in Discoveries</Link>
          </p>
        ) : (
          <p className={styles.text}>Nothing: everything has a place.</p>
        )}
        {(r.placed > 0 || r.declined > 0) && (
          <p className={styles.quiet}>
            {r.placed} placed since, {r.declined} not needed.
          </p>
        )}
        {r.skipped.length > 0 && (
          <p className={styles.quiet}>You chose to leave out: {r.skipped.join(", ")}.</p>
        )}
      </section>

      {r.left_out.length > 0 && (
        <section className={styles.block} aria-label="No place in LoreStudio">
          <h3 className={styles.heading}>No place in LoreStudio</h3>
          <ul className={styles.facts}>
            {r.left_out.map((x) => (
              <li key={x.what}>
                <strong>{x.what}</strong>
                {x.examples.length > 0 && <span className={styles.sub}> on {x.examples.join(", ")}</span>}
                <span className={styles.why}>{x.why}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.nothing_set.length > 0 && (
        <p className={styles.quiet}>
          Never set in the file, so nothing was lost: {r.nothing_set.join(", ")}.
        </p>
      )}

      {r.not_in_file.length > 0 && (
        <section className={styles.block} aria-label="Not in the file">
          <h3 className={styles.heading}>Not in the file</h3>
          <p className={styles.quiet}>
            {SOURCES[r.source]} keeps these, but its export leaves them out. Copy what you need from it by
            hand.
          </p>
          <ul className={styles.facts}>
            {r.not_in_file.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}

      {r.original && (
        <section className={styles.block} aria-label="The original file">
          <h3 className={styles.heading}>The original file</h3>
          <a
            className={styles.download}
            href={api.assetFileUrl(r.original.asset_id)}
            download={r.original.filename}
          >
            <Download size={13} aria-hidden /> {r.original.filename}{" "}
            <span className={styles.sub}>{Math.max(1, Math.round(r.original.size_bytes / 1024))} KB</span>
          </a>
        </section>
      )}
    </article>
  );
}
