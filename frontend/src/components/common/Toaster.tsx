import { X } from "lucide-react";
import { useToastStore, type Toast } from "../../stores/toastStore";
import styles from "./Toaster.module.css";

/** Where toasts appear (doc 13 P6), mounted once in the layout. Errors are announced at once. */
export default function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className={styles.stack}>
      <div role="status" aria-live="polite" className={styles.region}>
        {toasts
          .filter((t) => t.tone !== "error")
          .map((t) => (
            <Item key={t.id} toast={t} onClose={() => dismiss(t.id)} />
          ))}
      </div>
      <div role="alert" className={styles.region}>
        {toasts
          .filter((t) => t.tone === "error")
          .map((t) => (
            <Item key={t.id} toast={t} onClose={() => dismiss(t.id)} />
          ))}
      </div>
    </div>
  );
}

function Item({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  return (
    <div className={styles.toast} data-tone={toast.tone}>
      <span>{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            toast.action?.run();
            onClose();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className={styles.close} onClick={onClose} aria-label="Dismiss">
        <X size={12} />
      </button>
    </div>
  );
}
