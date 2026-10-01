import { useState, FormEvent, useEffect } from "react";
import { FileText, Link, File, Loader2 } from "lucide-react";
import { api } from "../../api/client";
import type { CompendiumEntry, StoryAsset } from "../../types";
import { Modal } from "../common";
import styles from "./CompendiumCreateDialog.module.css";

interface Props {
  storyId: string;
  editing?: CompendiumEntry;
  onClose: () => void;
  onCreated: (entry: CompendiumEntry) => void;
}

type Tab = "note" | "url" | "document";

export default function CompendiumCreateDialog({ storyId, editing, onClose, onCreated }: Props) {
  const isEditing = !!editing;
  const initialTab: Tab = (editing?.entry_type as Tab) ?? "note";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [content, setContent] = useState(editing?.content ?? "");
  const [url, setUrl] = useState(editing?.url ?? "");
  const [fetchMeta, setFetchMeta] = useState(true);
  const [category, setCategory] = useState(editing?.category ?? "general");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [tagInput, setTagInput] = useState((editing?.tags ?? []).join(", "));
  const [selectedAssetId, setSelectedAssetId] = useState(editing?.asset_id ?? "");
  const [assets, setAssets] = useState<StoryAsset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === "document") {
      api
        .listAssets(storyId)
        .then(setAssets)
        .catch(() => {});
    }
  }, [tab, storyId]);

  function parseTags(): string[] {
    return tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const tags = parseTags();

    try {
      let result: CompendiumEntry;

      if (isEditing) {
        result = await api.updateCompendiumEntry(editing!.id, {
          title: title.trim() || undefined,
          content: tab === "note" ? content : undefined,
          url: tab === "url" ? url.trim() : undefined,
          tags,
          category,
          notes,
        });
      } else if (tab === "note") {
        result = await api.createCompendiumNote(storyId, {
          title: title.trim(),
          content,
          tags,
          category,
          notes,
        });
      } else if (tab === "url") {
        result = await api.createCompendiumUrl(storyId, {
          title: title.trim() || undefined,
          url: url.trim(),
          tags,
          category,
          notes,
          fetch_metadata: fetchMeta,
        });
      } else {
        result = await api.createCompendiumDocument(storyId, {
          title: title.trim() || undefined,
          asset_id: selectedAssetId,
          tags,
          category,
          notes,
        });
      }

      onCreated(result);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    !loading && (tab === "note" ? !!title.trim() : tab === "url" ? !!url.trim() : !!selectedAssetId);

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "note", label: "Note", icon: FileText },
    { id: "url", label: "URL", icon: Link },
    { id: "document", label: "Document", icon: File },
  ];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEditing ? "Edit entry" : "Add to Compendium"}
      size="md"
      footer={
        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="compendium-form" className={styles.submitBtn} disabled={!canSubmit}>
            {loading ? <Loader2 size={14} className={styles.spin} /> : null}
            {isEditing ? "Save" : "Add"}
          </button>
        </div>
      }
    >
      {!isEditing && (
        <div className={styles.tabs}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`${styles.tabBtn} ${tab === id ? styles.tabActive : ""}`}
              onClick={() => setTab(id)}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      )}

      <form id="compendium-form" className={styles.form} onSubmit={handleSubmit}>
        {/* URL input shown first for URL tab */}
        {tab === "url" && !isEditing && (
          <div className={styles.field}>
            <label className={styles.label}>URL *</label>
            <input
              className={styles.input}
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            <label className={styles.checkRow}>
              <input type="checkbox" checked={fetchMeta} onChange={(e) => setFetchMeta(e.target.checked)} />
              <span>Auto-fetch title and description</span>
            </label>
          </div>
        )}

        {/* Document asset picker */}
        {tab === "document" && !isEditing && (
          <div className={styles.field}>
            <label className={styles.label}>Asset *</label>
            {assets.length === 0 ? (
              <p className={styles.hint}>
                Upload a file in <strong>Media &amp; Diagrams</strong> first, then return here to link it.
              </p>
            ) : (
              <select
                className={styles.select}
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                required
              >
                <option value="">Select an asset</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.original_filename} ({(a.size_bytes / 1024).toFixed(0)} KB)
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Title */}
        <div className={styles.field}>
          <label className={styles.label}>
            Title {tab === "note" ? "*" : "(optional, auto-filled if blank)"}
          </label>
          <input
            className={styles.input}
            type="text"
            placeholder={
              tab === "url"
                ? "Leave blank to use page title"
                : tab === "document"
                  ? "Leave blank to use filename"
                  : "Title"
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required={tab === "note"}
          />
        </div>

        {/* Note content */}
        {tab === "note" && (
          <div className={styles.field}>
            <label className={styles.label}>Content</label>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              placeholder="Your research notes…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
            />
          </div>
        )}

        {/* URL edit field (when editing existing URL) */}
        {tab === "url" && isEditing && (
          <div className={styles.field}>
            <label className={styles.label}>URL</label>
            <input className={styles.input} type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
        )}

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Category</label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. history, worldbuilding…"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Tags</label>
            <input
              className={styles.input}
              type="text"
              placeholder="comma separated"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Notes</label>
          <textarea
            className={`${styles.input} ${styles.textareaSm}`}
            placeholder="Why is this relevant to your story?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      </form>
    </Modal>
  );
}
