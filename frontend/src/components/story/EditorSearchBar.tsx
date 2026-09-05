import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { ChevronUp, ChevronDown, X, CaseSensitive, Replace } from "lucide-react";
import styles from "./EditorSearchBar.module.css";

interface Props {
  editor: Editor;
  onClose: () => void;
}

export default function EditorSearchBar({ editor, onClose }: Props) {
  const [term, setTerm] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus on mount
  useEffect(() => {
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  // Sync search term + case-sensitivity to extension
  useEffect(() => {
    (editor.commands as unknown as Record<string, (arg: unknown) => boolean>).setSearchTerm?.(term);
  }, [editor, term]);

  useEffect(() => {
    (editor.commands as unknown as Record<string, (arg: unknown) => boolean>).setSearchCaseSensitive?.(
      caseSensitive,
    );
  }, [editor, caseSensitive]);

  // Clear highlights when unmounted
  useEffect(() => {
    return () => {
      (editor.commands as unknown as Record<string, (arg: unknown) => boolean>).setSearchTerm?.("");
    };
  }, [editor]);

  const storage = editor.storage.lorestudioSearch as
    { resultCount: number; currentIndex: number } | undefined;
  const resultCount = storage?.resultCount ?? 0;
  const currentIndex = storage?.currentIndex ?? 0;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        (editor.commands as unknown as Record<string, () => boolean>).goToPrevSearchResult?.();
      } else {
        (editor.commands as unknown as Record<string, () => boolean>).goToNextSearchResult?.();
      }
    }
  }

  return (
    <div className={styles.bar} role="search" aria-label="Find in scene">
      <div className={styles.row}>
        <div className={styles.inputWrap}>
          <input
            ref={searchInputRef}
            className={styles.input}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Find…"
            aria-label="Search term"
            spellCheck={false}
            autoComplete="off"
          />
          {term && (
            <span className={styles.count} aria-live="polite">
              {resultCount === 0 ? "No results" : `${currentIndex + 1} / ${resultCount}`}
            </span>
          )}
        </div>

        <button
          className={`${styles.iconBtn}${caseSensitive ? ` ${styles.iconBtnActive}` : ""}`}
          onClick={() => setCaseSensitive((c) => !c)}
          title="Case sensitive (Alt+C)"
          aria-pressed={caseSensitive}
        >
          <CaseSensitive size={14} />
        </button>

        <button
          className={styles.iconBtn}
          onClick={() =>
            (editor.commands as unknown as Record<string, () => boolean>).goToPrevSearchResult?.()
          }
          disabled={resultCount === 0}
          title="Previous match (Shift+Enter)"
          aria-label="Previous match"
        >
          <ChevronUp size={14} />
        </button>

        <button
          className={styles.iconBtn}
          onClick={() =>
            (editor.commands as unknown as Record<string, () => boolean>).goToNextSearchResult?.()
          }
          disabled={resultCount === 0}
          title="Next match (Enter)"
          aria-label="Next match"
        >
          <ChevronDown size={14} />
        </button>

        <button
          className={`${styles.iconBtn}${showReplace ? ` ${styles.iconBtnActive}` : ""}`}
          onClick={() => setShowReplace((r) => !r)}
          title="Toggle replace"
          aria-expanded={showReplace}
          aria-label="Toggle replace"
        >
          <Replace size={14} />
        </button>

        <button
          className={styles.iconBtn}
          onClick={onClose}
          title="Close (Escape)"
          aria-label="Close find bar"
        >
          <X size={14} />
        </button>
      </div>

      {showReplace && (
        <div className={styles.row}>
          <div className={styles.inputWrap}>
            <input
              className={styles.input}
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
              }}
              placeholder="Replace with…"
              aria-label="Replacement text"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <button
            className={styles.replaceBtn}
            onClick={() =>
              (
                editor.commands as unknown as Record<string, (r: string) => boolean>
              ).replaceCurrentSearchResult?.(replacement)
            }
            disabled={resultCount === 0}
          >
            Replace
          </button>
          <button
            className={styles.replaceBtn}
            onClick={() =>
              (
                editor.commands as unknown as Record<string, (r: string) => boolean>
              ).replaceAllSearchResults?.(replacement)
            }
            disabled={resultCount === 0}
          >
            Replace All
          </button>
        </div>
      )}
    </div>
  );
}
