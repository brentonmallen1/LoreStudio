import { useEffect, useState } from "react";
import { Plus, Search, BookOpen, FileText, Link, File } from "lucide-react";
import { api } from "../../api/client";
import type { CompendiumEntrySummary, CompendiumEntry } from "../../types";
import CompendiumEntryCard from "./CompendiumEntryCard";
import CompendiumCreateDialog from "./CompendiumCreateDialog";
import CompendiumEntryDetail from "./CompendiumEntryDetail";
import styles from "./CompendiumPanel.module.css";

interface Props {
  storyId: string;
}

type FilterType = "all" | "note" | "url" | "document";

const FILTER_TABS: { id: FilterType; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "All", icon: BookOpen },
  { id: "note", label: "Notes", icon: FileText },
  { id: "url", label: "URLs", icon: Link },
  { id: "document", label: "Documents", icon: File },
];

export default function CompendiumPanel({ storyId }: Props) {
  const [entries, setEntries] = useState<CompendiumEntrySummary[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CompendiumEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<CompendiumEntry | null>(null);

  async function load() {
    const params = filter !== "all" ? { entry_type: filter } : {};
    const data = await api.listCompendiumEntries(storyId, params);
    setEntries(data);
  }

  useEffect(() => {
    load();
  }, [storyId, filter]);

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

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const entry = entries.find((en) => en.id === id);
    if (!entry) return;
    if (!confirm(`Delete "${entry.title}"? This cannot be undone.`)) return;
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
    setEntries((prev) => [
      { ...entry, attachment_count: 0 },
      ...prev,
    ]);
    setCreating(false);
    setSelectedEntry(entry);
  }

  function handleUpdated(updated: CompendiumEntry) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === updated.id
          ? { ...updated, attachment_count: updated.attachments.length }
          : e
      )
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
                ? { ...updated, attachment_count: updated.attachments.length }
                : e
            )
          );
        }}
        storyId={storyId}
      />
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <h1 className={styles.title}>Compendium</h1>
          <button className={styles.addBtn} onClick={() => setCreating(true)}>
            <Plus size={14} />
            Add Entry
          </button>
        </div>
        <p className={styles.subtitle}>
          Research notes, reference URLs, and documents that inform your story.
        </p>

        <div className={styles.toolbar}>
          <div className={styles.filterTabs}>
            {FILTER_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`${styles.filterTab} ${filter === id ? styles.filterTabActive : ""}`}
                onClick={() => setFilter(id)}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          <div className={styles.searchWrap}>
            <Search size={13} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

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
                onDelete={(e) => handleDelete(entry.id, e)}
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
