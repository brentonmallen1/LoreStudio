import styles from "./TabActivityIndicator.module.css";
import type { TabActivityStatus } from "../../stores/llmStore";

interface TabActivityIndicatorProps {
  status: TabActivityStatus;
}

export function TabActivityIndicator({ status }: TabActivityIndicatorProps) {
  if (!status) return null;
  return (
    <span
      className={`${styles.led} ${styles[status]}`}
      title={
        status === "streaming"
          ? "AI response in progress…"
          : status === "unviewed"
            ? "New AI response"
            : "AI request failed"
      }
    />
  );
}
