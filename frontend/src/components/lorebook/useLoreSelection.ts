import { useCallback, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { sectionPath } from "../../lib/routes";

/**
 * Which entry a section shows, kept in the address (`/lorebook/places/:entryId`) so
 * Back, links and the palette all land on the same sheet. `autoFirst` opens the first entry
 * when none is named, for sections that have no overview of their own.
 */
export function useLoreSelection(section: string, ids: string[], autoFirst: boolean, route = "lorebook") {
  const { storyId, entryId } = useParams<{ storyId: string; entryId?: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const select = useCallback(
    (id: string | null, opts: { replace?: boolean; keepQuery?: boolean } = {}) => {
      if (!storyId) return;
      const base = sectionPath(storyId, route, section, id ?? undefined);
      const qs = opts.keepQuery ? params.toString() : "";
      navigate(qs ? `${base}?${qs}` : base, { replace: opts.replace });
    },
    [storyId, route, section, navigate, params],
  );

  const first = ids[0];
  const missing = entryId !== undefined && ids.length > 0 && !ids.includes(entryId);
  useEffect(() => {
    if (!autoFirst || !first) return;
    if (entryId === undefined || missing) select(first, { replace: true });
  }, [autoFirst, first, entryId, missing, select]);

  return { storyId: storyId!, selectedId: entryId && !missing ? entryId : null, select };
}
