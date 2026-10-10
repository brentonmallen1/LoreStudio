import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { File, FileText, Image as ImageIcon, Link as LinkIcon, Network, Plus, Search } from "lucide-react";
import { api } from "../../api/client";
import { indexRows, KIND_LABELS, matches, type IndexKind, type IndexRow } from "../../lib/compendium";
import { sectionPath } from "../../lib/routes";
import { ago } from "../../lib/serverDate";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { elementForRow, useSeriesStore } from "../../stores/seriesStore";
import PageHeader from "../layout/PageHeader";
import styles from "./CompendiumIndex.module.css";

const ICONS: Record<IndexKind, typeof File> = {
  note: FileText,
  url: LinkIcon,
  document: File,
  image: ImageIcon,
  diagram: Network,
};
const KINDS = Object.keys(KIND_LABELS) as IndexKind[];

/**
 * Everything in the Compendium (doc 13 P5): research, images and diagrams in one list
 * with one search, each row opening where it is kept.
 */
export default function CompendiumIndex({ storyId }: { storyId: string }) {
  // In a book of a series: what it shares with the other books, marked (v1.5).
  const series = useSeriesStore((s) => s.series);
  const [rows, setRows] = useState<IndexRow[] | null>(null);
  const [params, setParams] = useSearchParams();
  const kind = KINDS.find((k) => k === params.get("kind")) ?? null;
  const [q, setQ] = useState("");

  const load = () =>
    Promise.all([api.listCompendiumEntries(storyId, {}), api.listAssets(storyId), api.listDiagrams(storyId)])
      .then(([e, a, d]) => setRows(indexRows(e, a, d)))
      .catch(() => setRows([]));
  useEffect(() => {
    void load();
  }, [storyId]); // eslint-disable-line react-hooks/exhaustive-deps
  useReloadOnUndo(
    ["compendium_entry", "compendium_attachment", "story_asset", "diagram", "series_element_member"],
    () => void load(),
  );

  const shown = useMemo(
    () => (rows ?? []).filter((r) => (!kind || r.kind === kind) && matches(r, q)),
    [rows, kind, q],
  );
  const count = (k: IndexKind) => (rows ?? []).filter((r) => r.kind === k).length;
  const where = (r: IndexRow) =>
    r.kind === "image"
      ? sectionPath(storyId, "compendium", "images", r.id)
      : r.kind === "diagram"
        ? sectionPath(storyId, "compendium", "diagrams", r.id)
        : sectionPath(storyId, "compendium", "research", r.id);

  return (
    <div className={styles.page}>
      <PageHeader
        title="Compendium"
        summary={rows ? `${rows.length} things that inform the story, newest first` : "Gathering…"}
        primary={{
          label: "Add research",
          icon: Plus,
          to: `${sectionPath(storyId, "compendium", "research")}?new=1`,
        }}
        aside={
          <label className={styles.search}>
            <Search size={13} aria-hidden />
            <input
              type="search"
              placeholder="Search the Compendium…"
              aria-label="Search the Compendium"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        }
        chips={
          <div className={styles.chips} role="group" aria-label="Show only">
            <button
              type="button"
              className={styles.chip}
              aria-pressed={!kind}
              onClick={() => setParams({}, { replace: true })}
            >
              Everything <span>{rows?.length ?? 0}</span>
            </button>
            {KINDS.filter((k) => count(k) > 0).map((k) => (
              <button
                key={k}
                type="button"
                className={styles.chip}
                aria-pressed={kind === k}
                onClick={() => setParams(kind === k ? {} : { kind: k }, { replace: true })}
              >
                {KIND_LABELS[k]} <span>{count(k)}</span>
              </button>
            ))}
          </div>
        }
      />
      <div className={styles.scroll}>
        <div className={styles.column}>
          {rows && shown.length === 0 && (
            <p className={styles.empty}>
              {rows.length === 0
                ? "Nothing here yet. Research notes, links, documents, images and diagrams all gather here."
                : "Nothing matches."}
            </p>
          )}
          <ul className={styles.list}>
            {shown.map((r) => {
              const Icon = ICONS[r.kind];
              return (
                <li key={`${r.kind}:${r.id}`}>
                  <Link to={where(r)} className={styles.row}>
                    {r.kind === "image" ? (
                      <img className={styles.thumb} src={api.assetFileUrl(r.id)} alt="" loading="lazy" />
                    ) : (
                      <span className={styles.icon} aria-hidden>
                        <Icon size={15} />
                      </span>
                    )}
                    <span className={styles.body}>
                      <span className={styles.title}>{r.title}</span>
                      {r.preview && <span className={styles.preview}>{r.preview}</span>}
                    </span>
                    <span className={styles.meta}>
                      <span>
                        {KIND_LABELS[r.kind].replace(/s$/, "")}
                        {elementForRow(series, storyId, r.id) && " · shared with the series"}
                        {r.tags.length > 0 && ` · ${r.tags.slice(0, 3).join(", ")}`}
                      </span>
                      <span className={styles.when}>{ago(r.updated_at)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
