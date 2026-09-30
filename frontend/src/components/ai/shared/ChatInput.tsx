import { useRef, type RefObject } from "react";
import { Send, Square } from "lucide-react";
import styles from "./ChatInput.module.css";

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  placeholder?: string;
  hintLeft?: React.ReactNode;
  hintRight?: React.ReactNode;
  /** A wrapper's first look at a key; returning true means it was handled (the mention popover). */
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
  /** Rendered above the row: chips, a popover. */
  above?: React.ReactNode;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  onCancel,
  disabled,
  placeholder = "Send a message…",
  hintLeft,
  hintRight,
  onKeyDown,
  above,
  textareaRef,
}: ChatInputProps) {
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? ownRef;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (onKeyDown?.(e)) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className={styles.root}>
      {above}
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
        {disabled && onCancel ? (
          <button onClick={onCancel} className={styles.stopBtn} title="Cancel response">
            <Square size={13} />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={disabled || !value.trim()}
            className={styles.sendBtn}
            title="Send (Enter)"
          >
            <Send size={14} />
          </button>
        )}
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
