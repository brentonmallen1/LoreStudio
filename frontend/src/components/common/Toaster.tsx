import { X } from "lucide-react";
import { useToastStore } from "../../stores/toastStore";
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
            <Item key={t.id} text={t.text} tone={t.tone} onClose={() => dismiss(t.id)} />
          ))}
      </div>
      <div role="alert" className={styles.region}>
        {toasts
          .filter((t) => t.tone === "error")
          .map((t) => (
            <Item key={t.id} text={t.text} tone={t.tone} onClose={() => dismiss(t.id)} />
          ))}
      </div>
    </div>
  );
}

function Item({ text, tone, onClose }: { text: string; tone: string; onClose: () => void }) {
  return (
    <div className={styles.toast} data-tone={tone}>
      <span>{text}</span>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Dismiss">
        <X size={12} />
      </button>
    </div>
  );
}
