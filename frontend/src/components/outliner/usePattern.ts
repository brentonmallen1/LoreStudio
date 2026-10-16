import { useCallback } from "react";
import { api } from "../../api/client";
import { sceneLeaves } from "../../lib/planning/methods";
import { patternStanding } from "../../lib/patterns";
import { useStoryStore } from "../../stores/storyStore";
import { toast } from "../../stores/toastStore";
import type { BeatSheet } from "../../types";

/**
 * The classic pattern shown on the Outline (doc 29 D5): the story's beat sheet, the one field
 * Story identity and the pattern walks in Plan with questions set too. Null when none is on.
 * `carry` gives a scene a moment, or takes it away (null), through the structure route, which
 * records the change for ⌘Z.
 */
export function usePattern() {
  const active = useActiveSheet();
  const structure = useStoryStore((s) => s.structure);
  const template = useStoryStore((s) => s.activeTemplate);
  const scenes = sceneLeaves(structure, template);
  const standing = active.sheet ? patternStanding(active.sheet, scenes) : null;
  return { ...active, scenes, standing };
}

/** The pattern turned on and what changes it, without reading the whole story (a row's tag). */
export function useActiveSheet() {
  const beatSheetId = useStoryStore((s) => s.activeStory?.beat_sheet_id);
  const sheets = useStoryStore((s) => s.beatSheets);
  const sheet: BeatSheet | null = sheets.find((s) => s.id === beatSheetId) ?? null;

  const choose = useCallback(async (id: string | null) => {
    const { activeStory, setActiveStory } = useStoryStore.getState();
    if (!activeStory) return;
    try {
      setActiveStory(await api.updateStory(activeStory.id, { beat_sheet_id: id }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The pattern could not be changed.");
    }
  }, []);

  const carry = useCallback(async (nodeId: string, beatId: string | null) => {
    const { patchNode } = useStoryStore.getState();
    patchNode(nodeId, { beat_id: beatId });
    try {
      await api.updateNode(nodeId, { beat_id: beatId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That scene's moment could not be saved.");
    }
  }, []);

  const beatOf = (beatId: string | null | undefined) => sheet?.beats.find((b) => b.id === beatId) ?? null;

  return { sheet, sheets, choose, carry, beatOf };
}
