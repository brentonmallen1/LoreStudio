import type { FocusEvent } from "react";
import type { useHoverTip } from "../common/useHoverTip";

type Tip = ReturnType<typeof useHoverTip>;

/** Whether any line in the row marked `data-clip` is cut short by its "…". */
export function clipped(row: Element): boolean {
  return [...row.querySelectorAll<HTMLElement>("[data-clip]")].some(
    (el) => el.scrollWidth > el.clientWidth + 1,
  );
}

/**
 * The Outline's rows end a long line in "…" (one line each, so the list stays a list). The
 * pointer gets the whole line from each piece's `title`; the keyboard gets it here, in the
 * row's tip, when the row itself is reached and something in it is cut short.
 */
export function clipTipHandlers(tip: Tip, text: string) {
  const bound = tip.bind(text);
  return {
    onFocus: (e: FocusEvent<HTMLElement>) => {
      if (e.target === e.currentTarget && clipped(e.currentTarget)) bound.onFocus?.(e);
    },
    onBlur: () => tip.hide(),
  };
}
