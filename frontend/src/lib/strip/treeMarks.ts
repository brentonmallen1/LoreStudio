import { useMemo } from "react";
import { useUIStore } from "../../stores/uiStore";
import { useColourContext, useStripLine } from "./useColourContext";
import type { ColourContext, ColourMode, Stop } from "./stripModel";

/**
 * What the outline needs to mark its rows the way the line marks its stops (doc 24: the
 * outline is the strip's one expanded view, so it carries the colours the chapter rows did).
 */
export interface TreeMarks {
  /** Each scene's stop, by node id. */
  stops: Map<string, Stop>;
  /** Each chapter's scenes, by node id, for the bars under a folded chapter. */
  chapters: Map<string, Stop[]>;
  /** Each act's numeral and each chapter's number, as the line shows them, by node id. */
  labels: Map<string, string>;
  mode: ColourMode;
  ctx: ColourContext;
  currentIndex: number;
}

export function useTreeMarks(): TreeMarks {
  const line = useStripLine();
  const ctx = useColourContext();
  const mode = useUIStore((s) => s.stripColourMode);
  return useMemo(
    () => ({
      stops: new Map(line.stops.map((s) => [s.node.id, s])),
      chapters: new Map(
        line.hasStations
          ? line.stations.flatMap((st) => (st.node ? [[st.node.id, st.stops] as const] : []))
          : [],
      ),
      labels: new Map([
        ...(line.hasActs ? line.acts.flatMap((a) => (a.node ? [[a.node.id, a.label] as const] : [])) : []),
        ...(line.hasStations
          ? line.stations.flatMap((st) => (st.node ? [[st.node.id, String(st.number)] as const] : []))
          : []),
      ]),
      mode,
      ctx,
      currentIndex: line.currentIndex,
    }),
    [line, ctx, mode],
  );
}
