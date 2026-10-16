import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { HOVER_MS } from "../common/useHoverTip";
import tipStyles from "../common/HoverTip.module.css";

const MARGIN = 8;

/**
 * Who says a line whose tag is hidden (2026-10-16): with "Hide speaker tags" on and the caret
 * elsewhere, resting the pointer on a tagged line names its speaker in the small lifted label
 * the rows' tips use (HoverTip.module.css). Inside the line the caret shows the tag itself
 * (DialogueExtension's reveal), so the tip stays away there; a tag that names nobody is never
 * hidden, so it has no tip either.
 */
export function useSpeakerTip(editor: Editor | null): ReactNode {
  const [tip, setTip] = useState<{ text: string; top: number; left: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const over = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const dom = editor.view.dom as HTMLElement;
    const hide = () => {
      clearTimeout(timer.current);
      over.current = null;
      setTip(null);
    };
    const onOver = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(
        ".dialogue-explicit[data-speaker-named]",
      );
      const hidden = document.documentElement.dataset.speakerTags === "hidden";
      if (!el || !hidden || el.classList.contains("dialogue-editing")) return hide();
      if (el === over.current) return;
      over.current = el;
      clearTimeout(timer.current);
      const { clientX, clientY } = e;
      timer.current = setTimeout(() => {
        // A line that wraps has a box per line of text: the tip goes under the one pointed at.
        const rects = [...el.getClientRects()];
        const r = rects.find((b) => clientY >= b.top && clientY <= b.bottom) ?? rects.at(-1);
        if (!r) return;
        const left = Math.min(Math.max(MARGIN, clientX - 12), window.innerWidth - MARGIN - 240);
        setTip({ text: `Said by ${el.dataset.dialogueSpeaker}`, top: r.bottom + 4, left });
      }, HOVER_MS);
    };
    dom.addEventListener("mouseover", onOver);
    dom.addEventListener("mouseleave", hide);
    dom.addEventListener("keydown", hide);
    dom.addEventListener("mousedown", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      hide();
      dom.removeEventListener("mouseover", onOver);
      dom.removeEventListener("mouseleave", hide);
      dom.removeEventListener("keydown", hide);
      dom.removeEventListener("mousedown", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, [editor]);

  return tip
    ? createPortal(
        <div className={tipStyles.tip} style={{ top: tip.top, left: tip.left }} aria-hidden>
          {tip.text}
        </div>,
        document.body,
      )
    : null;
}
