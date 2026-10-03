import { useRef, useState } from "react";

/**
 * A text input that keeps its own text while you type and saves when you leave it or press
 * Enter (Escape puts the saved text back). Doc 18: the clue and try/fail editors sent a save
 * on every keystroke into an input the server's answer redrew, so letters went missing.
 */
export default function CommitInput({
  value,
  onCommit,
  ...rest
}: { value: string; onCommit: (text: string) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur"
>) {
  // null while not editing, so the saved value shows (and follows an undo) until you type.
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);

  function commit() {
    if (!cancelled.current && draft !== null && draft !== value) onCommit(draft);
    cancelled.current = false;
    setDraft(null);
  }

  return (
    <input
      {...rest}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}
