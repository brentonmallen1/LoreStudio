import { useMemo } from "react";
import { useOpenFindings } from "../../stores/findingsStore";
import { useStoryStore } from "../../stores/storyStore";
import { buildLine, type ColourContext, type Line } from "./stripModel";

/**
 * What the strip's colour modes read (who, threads, beats, findings, whose eyes), in one
 * place so the strip and the crumbs in the header colour a scene the same way (doc 24 P5).
 */
export function useColourContext(): ColourContext {
  const characters = useStoryStore((s) => s.characters);
  const threads = useStoryStore((s) => s.threads);
  const beatSheets = useStoryStore((s) => s.beatSheets);
  const beatSheetId = useStoryStore((s) => s.activeStory?.beat_sheet_id);
  const storyPov = useStoryStore((s) => s.activeStory?.pov_character_id ?? null);
  const findings = useOpenFindings();
  return useMemo(
    () => ({
      characters,
      threads,
      beatSheet: beatSheets.find((b) => b.id === beatSheetId) ?? null,
      findings,
      storyPov,
    }),
    [characters, threads, beatSheets, beatSheetId, findings, storyPov],
  );
}

/** The book as the strip's line: chapters as stations, scenes as stops, where you are. */
export function useStripLine(): Line {
  const structure = useStoryStore((s) => s.structure);
  const template = useStoryStore((s) => s.activeTemplate);
  const activeNodeId = useStoryStore((s) => s.activeNode?.id);
  const sceneCast = useStoryStore((s) => s.sceneCast);
  return useMemo(
    () => buildLine(structure, template, activeNodeId, sceneCast),
    [structure, template, activeNodeId, sceneCast],
  );
}
