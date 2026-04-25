import { useState } from "react";
import {
  ArrowLeft,
  FileText,
  Link,
  File,
  Pencil,
  Trash2,
  RefreshCw,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { api } from "../../api/client";
import type { CompendiumEntry } from "../../types";
import styles from "./CompendiumEntryDetail.module.css";

interface Props {
  entry: CompendiumEntry;
  storyId: string;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onUpdated: (updated: CompendiumEntry) => void;
}

export default function CompendiumEntryDetail({
  entry,
  onBack,
  onEdit,
  onDelete,
  onUpdated,
}: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  async function handleRefreshUrl() {
    setRefreshing(true);
    try {
      const updated = await api.refreshCompendiumUrl(entry.id);
      onUpdated(updated);
    } finally {
      setRefreshing(false);
    }
  }

  async function doDelete() {
    setPendingDelete(false);
    setDeleting(true);
    await onDelete();
  }

  const icon =
    entry.entry_type === "note" ? (
      <FileText size={18} className={`${styles.typeIcon} ${styles.iconNote}`} />
    ) : entry.entry_type === "url" ? (
      <Link size={18} className={`${styles.typeIcon} ${styles.iconUrl}`} />
    ) : (
      <File size={18} className={`${styles.typeIcon} ${styles.iconDoc}`} />
    );

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* Back + actions */}
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={onBack}>
            <ArrowLeft size={14} />
            Compendium
          </button>
          <div className={styles.topActions}>
            {entry.entry_type === "url" && (
              <button
                className={styles.iconBtn}
                onClick={handleRefreshUrl}
                disabled={refreshing}
                title="Refresh URL metadata"
              >
                {refreshing ? <Loader2 size={14} className={styles.spin} /> : <RefreshCw size={14} />}
              </button>
            )}
            <button className={styles.iconBtn} onClick={onEdit} title="Edit">
              <Pencil size={14} />
            </button>
            {pendingDelete ? (
              <div className={styles.deleteConfirm}>
                <button className={styles.deleteConfirmYes} onClick={doDelete} disabled={deleting}>Delete</button>
                <button className={styles.deleteConfirmNo} onClick={() => setPendingDelete(false)}>Cancel</button>
              </div>
            ) : (
              <button
                className={`${styles.iconBtn} ${styles.deleteBtn}`}
                onClick={() => setPendingDelete(true)}
                disabled={deleting}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Header */}
        <div className={styles.header}>
          {icon}
          <h1 className={styles.title}>{entry.title}</h1>
        </div>

        {/* Meta row */}
        <div className={styles.metaRow}>
          <span className={styles.metaBadge}>{entry.entry_type}</span>
          {entry.category && entry.category !== "general" && (
            <span className={styles.metaBadge}>{entry.category}</span>
          )}
          {entry.tags.map((t) => (
            <span key={t} className={styles.tag}>{t}</span>
          ))}
        </div>

        {/* URL block */}
        {entry.entry_type === "url" && entry.url && (
          <div className={styles.urlBlock}>
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.urlLink}
            >
              {entry.url}
              <ExternalLink size={12} />
            </a>
            {entry.url_description && (
              <p className={styles.urlDesc}>{entry.url_description}</p>
            )}
            {entry.url_fetched_at && (
              <span className={styles.urlFetched}>
                Fetched {new Date(entry.url_fetched_at).toLocaleDateString()}
              </span>
            )}
          </div>
        )}

        {/* Note content */}
        {entry.entry_type === "note" && entry.content && (
          <div className={styles.contentBlock}>
            <pre className={styles.contentText}>{entry.content}</pre>
          </div>
        )}

        {/* Document info */}
        {entry.entry_type === "document" && entry.asset_id && (
          <div className={styles.docBlock}>
            <a
              href={api.assetFileUrl(entry.asset_id)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.docLink}
            >
              <File size={14} />
              View / Download
              <ExternalLink size={12} />
            </a>
          </div>
        )}

        {/* Author notes */}
        {entry.notes && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Notes</h3>
            <p className={styles.sectionText}>{entry.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
