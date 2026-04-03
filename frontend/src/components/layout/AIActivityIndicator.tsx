import { X } from "lucide-react";
import { useLLMStore } from "../../stores/llmStore";
import styles from "./AIActivityIndicator.module.css";

export default function AIActivityIndicator() {
  const requests = useLLMStore((s) => s.requests);
  const cancelRequest = useLLMStore((s) => s.cancelRequest);

  const active = Object.values(requests).filter((r) => r.status === "streaming");
  if (active.length === 0) return null;

  return (
    <div className={styles.indicator}>
      <div className={styles.header}>
        <span className={styles.pulse} aria-hidden />
        <span className={styles.label}>AI Working</span>
      </div>
      {active.map((req) => (
        <div key={req.id} className={styles.item}>
          <span className={styles.itemLabel}>{req.label}</span>
          <button
            className={styles.cancelBtn}
            onClick={() => cancelRequest(req.id)}
            aria-label={`Cancel ${req.label}`}
            title="Cancel"
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}
