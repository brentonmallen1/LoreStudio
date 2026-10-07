import { Brain } from "lucide-react";
import { useSessionThinking } from "../../../hooks/useThinking";
import styles from "./ChatInput.module.css";

/**
 * Think first, beside the composer of every conversation: whether the next reply reasons
 * before answering. It starts from the conversation's default (its feature, under Settings ›
 * Model parameters) and the author's choice stays with the conversation, in every window.
 */
export default function ThinkToggle({ sessionId }: { sessionId: string }) {
  const { on, byDefault, fallback, set } = useSessionThinking(sessionId);
  const why = byDefault
    ? `${on ? "On" : "Off"} by default for this kind of conversation`
    : `Default here: ${fallback ? "on" : "off"}`;
  return (
    <button
      type="button"
      className={`${styles.think} ${on ? styles.thinkOn : ""}`}
      aria-pressed={on}
      onClick={() => set(!on)}
      title={`Gemma reasons before answering: more considered, slower. ${why}.`}
    >
      <Brain size={12} aria-hidden />
      Think first
    </button>
  );
}
