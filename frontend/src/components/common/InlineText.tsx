import { Fragment } from "react";
import { SHORTCUTS, formatCombo, type ShortcutId } from "../../lib/keyboard/shortcuts";

/** `**bold**`, `` `code` `` or `{{key:id}}`, the three marks a glossary definition may use. */
const MARK = /(\*\*[^*]+\*\*|`[^`]+`|\{\{key:\w+\}\})/g;

/**
 * A line of glossary text with its few marks drawn, without a Markdown renderer: `Term`
 * shows on nearly every page, and its popover should not bring a parser with it.
 */
export default function InlineText({ text }: { text: string }) {
  return (
    <>
      {text.split(MARK).map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
        const id = part.slice(6, -2);
        return <kbd key={i}>{id in SHORTCUTS ? formatCombo(SHORTCUTS[id as ShortcutId].combo) : part}</kbd>;
      })}
    </>
  );
}
