import { FileText, Link, File, Paperclip, Pencil, Trash2 } from "lucide-react";
import type { CompendiumEntrySummary } from "../../types";
import styles from "./CompendiumPanel.module.css";

interface Props {
  entry: CompendiumEntrySummary;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  isPendingDelete?: boolean;
  onConfirmDelete?: () => void;
  onCancelDelete?: () => void;
}

function urlDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function CompendiumEntryCard({
  entry,
  onClick,
  onEdit,
  onDelete,
  isPendingDelete,
  onConfirmDelete,
  onCancelDelete,
}: Props) {
  const icon =
    entry.entry_type === "note" ? (
      <FileText size={15} className={`${styles.cardIcon} ${styles.cardIconNote}`} />
    ) : entry.entry_type === "url" ? (
      <Link size={15} className={`${styles.cardIcon} ${styles.cardIconUrl}`} />
    ) : (
      <File size={15} className={`${styles.cardIcon} ${styles.cardIconDoc}`} />
    );

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.cardTop}>
        {icon}
        <span className={styles.cardTitle}>{entry.title}</span>
      </div>

      {entry.entry_type === "url" && entry.url && (
        <div className={styles.cardUrl}>
          {entry.url_title && entry.url_title !== entry.title ? entry.url_title : urlDomain(entry.url)}
        </div>
      )}

      {entry.preview && <p className={styles.cardPreview}>{entry.preview}</p>}

      {entry.tags.length > 0 && (
        <div className={styles.cardTags}>
          {entry.tags.slice(0, 4).map((t) => (
            <span key={t} className={styles.tag}>
              {t}
            </span>
          ))}
          {entry.tags.length > 4 && <span className={styles.tag}>+{entry.tags.length - 4}</span>}
        </div>
      )}

      <div className={styles.cardFooter}>
        {entry.attachment_count > 0 ? (
          <span className={styles.attachBadge}>
            <Paperclip size={11} />
            {entry.attachment_count}
          </span>
        ) : (
          <span />
        )}
        <div className={styles.cardActions}>
          {isPendingDelete ? (
            <div className={styles.deleteConfirm} onClick={(e) => e.stopPropagation()}>
              <button className={styles.deleteConfirmYes} onClick={onConfirmDelete}>
                Delete
              </button>
              <button
                className={styles.deleteConfirmNo}
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelDelete?.();
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button className={styles.actionBtn} onClick={onEdit} title="Edit">
                <Pencil size={13} />
              </button>
              <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={onDelete} title="Delete">
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
