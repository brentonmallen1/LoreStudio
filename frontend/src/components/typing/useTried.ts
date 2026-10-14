import { useEffect, useState } from "react";
import type { HelperId } from "../../lib/typing/helpers";
import { onHelperUsed } from "../../stores/typingStore";

const NONE: ReadonlySet<HelperId> = new Set();

/**
 * The helpers used since this mounted, or since `reset` last changed: what was just tried
 * (doc 26, P5). A helper used before still ticks when it is tried again here.
 */
export function useTried(reset: unknown = null): ReadonlySet<HelperId> {
  const [tried, setTried] = useState<{ reset: unknown; ids: ReadonlySet<HelperId> }>({ reset, ids: NONE });
  useEffect(
    () =>
      onHelperUsed((id) =>
        setTried((was) => {
          const ids = was.reset === reset ? was.ids : NONE;
          return ids.has(id) ? { reset, ids } : { reset, ids: new Set(ids).add(id) };
        }),
      ),
    [reset],
  );
  return tried.reset === reset ? tried.ids : NONE;
}
