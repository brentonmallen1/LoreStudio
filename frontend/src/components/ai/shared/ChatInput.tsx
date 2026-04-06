import { useRef } from "react";
import { Send } from "lucide-react";
import styles from "./ChatInput.module.css";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  hintLeft?: React.ReactNode;
  hintRight?: React.ReactNode;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = "Send a message…",
  hintLeft,
  hintRight,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.row}>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className={styles.textarea}
          disabled={disabled}
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className={styles.sendBtn}
          title="Send (Enter)"
        >
          <Send size={14} />
        </button>
      </div>
      {(hintLeft || hintRight) && (
        <div className={styles.hints}>
          <span className={styles.hint}>{hintLeft ?? "Shift+Enter for newline"}</span>
          {hintRight && <span className={styles.hintRight}>{hintRight}</span>}
        </div>
      )}
    </div>
  );
}
