import { useState, type ReactNode } from "react";
import Modal from "./Modal";
import styles from "./NameDialog.module.css";

/**
 * Ask for a name before something is made (a scene split off, scenes wrapped in a chapter): one
 * field with a name ready to keep, a line on what will happen, Cancel and the action.
 */
export default function NameDialog({
  title,
  label,
  initial,
  children,
  confirm,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  label: string;
  initial: string;
  /** What will happen, in a line or two. */
  children?: ReactNode;
  confirm: string;
  busy?: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  const ok = !!name.trim() && !busy;
  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <div className={styles.footer}>
          <button type="button" className={styles.secondary} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" form="name-dialog" className={styles.primary} disabled={!ok}>
            {confirm}
          </button>
        </div>
      }
    >
      <form
        id="name-dialog"
        className={styles.body}
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onConfirm(name.trim());
        }}
      >
        <label className={styles.label}>
          {label}
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            autoFocus
          />
        </label>
        {children && <div className={styles.hint}>{children}</div>}
      </form>
    </Modal>
  );
}
