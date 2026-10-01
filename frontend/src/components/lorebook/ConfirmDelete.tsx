import Modal from "../common/Modal";
import styles from "./Lorebook.module.css";

/** "Delete The Lighthouse?" with what else goes with it. Undo brings it back. */
export default function ConfirmDelete({
  name,
  detail,
  onConfirm,
  onClose,
}: {
  name: string;
  detail?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Delete ${name}?`}
      size="sm"
      footer={
        <div className={styles.confirmFooter}>
          <button type="button" className={styles.confirmCancel} onClick={onClose}>
            Keep it
          </button>
          <button
            type="button"
            className={styles.confirmDelete}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Delete
          </button>
        </div>
      }
    >
      <p className={styles.cardHint}>{detail ?? "You can bring it back with Undo."}</p>
    </Modal>
  );
}
