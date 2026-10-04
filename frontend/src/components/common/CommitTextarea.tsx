import { useLayoutEffect, useRef, useState } from "react";

/**
 * CommitInput's twin for text that wraps: grows with what is in it, saves when you leave it
 * or press Enter (Shift+Enter for a new line), and Escape puts the saved text back.
 */
export default function CommitTextarea({
  value,
  onCommit,
  ...rest
}: { value: string; onCommit: (text: string) => void } & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "onBlur"
>) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const text = draft ?? value;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  function commit() {
    if (!cancelled.current && draft !== null && draft !== value) onCommit(draft);
    cancelled.current = false;
    setDraft(null);
  }

  return (
    <textarea
      rows={1}
      {...rest}
      ref={ref}
      value={text}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}
