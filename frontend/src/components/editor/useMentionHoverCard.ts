import { useEffect, useRef, useState, type RefObject } from "react";
import type { Character, Location } from "../../types";

export type HoverCard =
  | { open: false }
  | {
      open: true;
      type: "character" | "setting";
      name: string;
      found: boolean;
      entityId: string;
      roleOrLabel: string;
      pronouns?: string;
      excerpt: string;
      /** A character's plan: what they want and what stands in the way. */
      goal?: string;
      conflict?: string;
      rect: DOMRect;
    };

const SHOW_DELAY_MS = 500;
const CLOSE_DELAY_MS = 100;

function excerptOf(raw: string): string {
  return raw.slice(0, 120).trim() + (raw.length > 120 ? "…" : "");
}

/**
 * Hover card for @mentions and [[settings]] in the prose. Event delegation on the
 * scroll area; the listener reads characters/locations through refs so it never
 * needs to be re-bound.
 */
export type OpenedMention = Extract<HoverCard, { open: true }>;

export function useMentionHoverCard(
  scrollAreaRef: RefObject<HTMLDivElement | null>,
  cardRef: RefObject<HTMLDivElement | null>,
  characters: Character[],
  locations: Location[],
  rebindKey: string | undefined,
  /** ⌘/Ctrl-click on a mention: open it beside the page (doc 11). A plain click keeps placing the caret. */
  onOpen?: (mention: OpenedMention) => void,
) {
  const [card, setCard] = useState<HoverCard>({ open: false });
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const charactersRef = useRef(characters);
  const locationsRef = useRef(locations);
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    charactersRef.current = characters;
    locationsRef.current = locations;
    onOpenRef.current = onOpen;
  });

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;

    function lookup(type: "character" | "setting", name: string, rect: DOMRect): HoverCard {
      if (type === "character") {
        const char = charactersRef.current.find((c) => c.name === name);
        if (char) {
          return {
            open: true,
            type,
            name,
            found: true,
            entityId: char.id,
            roleOrLabel: char.role || "Character",
            pronouns: char.pronouns || undefined,
            excerpt: excerptOf(char.personality || char.motivation || ""),
            goal: excerptOf(char.mission_statement || "") || undefined,
            conflict: excerptOf(char.conflict || "") || undefined,
            rect,
          };
        }
      } else {
        const loc = locationsRef.current.find((s) => s.name === name);
        if (loc) {
          return {
            open: true,
            type,
            name,
            found: true,
            entityId: loc.id,
            roleOrLabel: "Location",
            excerpt: excerptOf(loc.description || ""),
            rect,
          };
        }
      }
      return { open: true, type, name, found: false, entityId: "", roleOrLabel: "", excerpt: "", rect };
    }

    function mentionTarget(e: MouseEvent): HTMLElement | null {
      return (e.target as Element).closest(".mention-char, .mention-setting, .mention-missing");
    }

    function onOver(e: MouseEvent) {
      const target = mentionTarget(e);
      if (!target) return;
      if (showTimer.current) clearTimeout(showTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      showTimer.current = setTimeout(() => {
        const name = target.getAttribute("data-mention-name") ?? "";
        const type = (target.getAttribute("data-mention-type") ?? "character") as "character" | "setting";
        setCard(lookup(type, name, target.getBoundingClientRect()));
      }, SHOW_DELAY_MS);
    }

    function onOut(e: MouseEvent) {
      if (!mentionTarget(e)) return;
      if (cardRef.current && cardRef.current.contains(e.relatedTarget as Node)) return;
      if (showTimer.current) clearTimeout(showTimer.current);
      closeTimer.current = setTimeout(() => setCard({ open: false }), CLOSE_DELAY_MS);
    }

    function onClick(e: MouseEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = mentionTarget(e);
      if (!target) return;
      const name = target.getAttribute("data-mention-name") ?? "";
      const type = (target.getAttribute("data-mention-type") ?? "character") as "character" | "setting";
      const found = lookup(type, name, target.getBoundingClientRect());
      if (!found.open || !found.found) return;
      e.preventDefault();
      if (showTimer.current) clearTimeout(showTimer.current);
      setCard({ open: false });
      onOpenRef.current?.(found);
    }

    el.addEventListener("mouseover", onOver);
    el.addEventListener("mouseout", onOut);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("mouseover", onOver);
      el.removeEventListener("mouseout", onOut);
      el.removeEventListener("click", onClick);
    };
  }, [rebindKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    card,
    close: () => setCard({ open: false }),
    cancelClose: () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
  };
}

export type HoverCardState = ReturnType<typeof useMentionHoverCard>;
