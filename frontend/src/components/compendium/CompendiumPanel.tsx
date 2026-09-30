import { useEffect, useState } from "react";
import { Plus, Search, BookOpen, FileText, Link, File } from "lucide-react";
import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import type { CompendiumEntrySummary, CompendiumEntry } from "../../types";
import CompendiumEntryCard from "./CompendiumEntryCard";
import CompendiumCreateDialog from "./CompendiumCreateDialog";
import CompendiumEntryDetail from "./CompendiumEntryDetail";
import PageHeader from "../layout/PageHeader";
import styles from "./CompendiumPanel.module.css";

interface Props {
  storyId: string;
}

type FilterType = "all" | "note" | "url" | "document";

const FILTER_TABS: { id: FilterType; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "All", icon: BookOpen },
  { id: "note", label: "Notes", icon: FileText },
  { id: "url", label: "Links", icon: Link },
  { id: "document", label: "Documents", icon: File },
];

export default function CompendiumPanel({ storyId }: Props) {
  const [entries, setEntries] = useState<CompendiumEntrySummary[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CompendiumEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<CompendiumEntry | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function load() {
    const params = filter !== "all" ? { entry_type: filter } : {};
    const data = await api.listCompendiumEntries(storyId, params);
    setEntries(data);
  }

  useEffect(() => {
    load();
  }, [storyId, filter]);

  useReloadOnUndo(["compendium_entry", "compendium_attachment"], () => {
    load();
    if (selectedEntry)
      api.getCompendiumEntry(selectedEntry.id).then(setSelectedEntry, () => setSelectedEntry(null));
  });

  const displayed = search
    ? entries.filter((e) => {
        const q = search.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          (e.url_title || "").toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
    : entries;

  async function doDelete(id: string) {
    setPendingDeleteId(null);
    await api.deleteCompendiumEntry(id);
    setEntries((prev) => prev.filter((en) => en.id !== id));
    if (selectedEntry?.id === id) setSelectedEntry(null);
  }

  async function handleEdit(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const full = await api.getCompendiumEntry(id);
    setEditingEntry(full);
  }

  async function handleCardClick(id: string) {
    const full = await api.getCompendiumEntry(id);
    setSelectedEntry(full);
  }

  function handleCreated(entry: CompendiumEntry) {
    setEntries((prev) => [{ ...entry, attachment_count: 0, preview: previewOf(entry) }, ...prev]);
    setCreating(false);
    setSelectedEntry(entry);
  }

  function handleUpdated(updated: CompendiumEntry) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === updated.id
          ? { ...updated, attachment_count: updated.attachments.length, preview: previewOf(updated) }
          : e,
      ),
    );
    setEditingEntry(null);
    if (selectedEntry?.id === updated.id) setSelectedEntry(updated);
  }

  if (selectedEntry && !editingEntry) {
    return (
      <CompendiumEntryDetail
        entry={selectedEntry}
        onBack={() => setSelectedEntry(null)}
        onEdit={() => setEditingEntry(selectedEntry)}
        onDelete={async () => {
          await api.deleteCompendiumEntry(selectedEntry.id);
          setEntries((prev) => prev.filter((e) => e.id !== selectedEntry.id));
          setSelectedEntry(null);
        }}
        onUpdated={(updated) => {
          setSelectedEntry(updated);
          setEntries((prev) =>
            prev.map((e) =>
              e.id === updated.id
                ? { ...updated, attachment_count: updated.attachments.length, preview: previewOf(updated) }
                : e,
            ),
          );
        }}
        storyId={storyId}
      />
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Research"
        summary={`${entries.length} ${entries.length === 1 ? "entry" : "entries"} · notes, links and documents that inform the story`}
        primary={{ label: "Add entry", icon: Plus, onClick: () => setCreating(true) }}
        aside={
          <div className={styles.searchWrap}>
            <Search size={13} className={styles.searchIcon} aria-hidden />
            <input
              className={styles.searchInput}
              placeholder="Search research…"
              aria-label="Search research"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        }
        chips={FILTER_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`${styles.filterTab} ${filter === id ? styles.filterTabActive : ""}`}
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
          >
            <Icon size={12} aria-hidden />
            {label}
          </button>
        ))}
      />
      <div className={styles.inner}>
        {displayed.length === 0 ? (
          <div className={styles.empty}>
            <BookOpen size={36} className={styles.emptyIcon} />
            <div className={styles.emptyTitle}>
              {search || filter !== "all" ? "No entries match" : "No entries yet"}
            </div>
            <p className={styles.emptyText}>
              {search || filter !== "all"
                ? "Try a different filter or search term."
                : "Add research notes, URL bookmarks, or uploaded documents to build your Compendium."}
            </p>
          </div>
        ) : (
          <div className={styles.grid}>
            {displayed.map((entry) => (
              <CompendiumEntryCard
                key={entry.id}
                entry={entry}
                onClick={() => handleCardClick(entry.id)}
                onEdit={(e) => handleEdit(entry.id, e)}
                onDelete={(e) => {
                  e.stopPropagation();
                  setPendingDeleteId(entry.id);
                }}
                isPendingDelete={pendingDeleteId === entry.id}
                onConfirmDelete={() => doDelete(entry.id)}
                onCancelDelete={() => setPendingDeleteId(null)}
              />
            ))}
          </div>
        )}
      </div>

      {creating && (
        <CompendiumCreateDialog
          storyId={storyId}
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      )}

      {editingEntry && (
        <CompendiumCreateDialog
          storyId={storyId}
          editing={editingEntry}
          onClose={() => setEditingEntry(null)}
          onCreated={handleUpdated}
        />
      )}
    </div>
  );
}

/** The list's preview for an entry edited here, the same rule the server uses. */
function previewOf(entry: CompendiumEntry): string {
  const source = entry.content || entry.url_description || entry.notes || "";
  const text = source
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length <= 180 ? text : `${text.slice(0, 180).replace(/\s+\S*$/, "")}…`;
}
