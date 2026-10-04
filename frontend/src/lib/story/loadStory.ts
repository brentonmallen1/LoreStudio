import { api } from "../../api/client";
import { sceneCastApi } from "../../api/sceneCast";
import { usePanelStore } from "../../stores/panelStore";
import { useSeriesStore } from "../../stores/seriesStore";
import { useStoryStore } from "../../stores/storyStore";
import type { StructureNode } from "../../types";

/**
 * Everything a story window needs in the stores (refactor doc 11, phase 5): the workspace
 * and the popped-out panel load the same way, so the tabs read the same cast, places and
 * threads in both. Returns the structure so the caller can decide what to open.
 */
export async function loadStoryIntoStores(storyId: string): Promise<StructureNode[]> {
  const [story, structure, characters, templates, beatSheets, locations, threads, cast] = await Promise.all([
    api.getStory(storyId),
    api.getStructure(storyId),
    api.listCharacters(storyId),
    api.listStructureTemplates(),
    api.listBeatSheets(),
    api.listLocationsFlat(storyId),
    api.listThreads(storyId),
    sceneCastApi.get(storyId).catch(() => null),
  ]);
  // The series it is in, if any: not waited for, nothing below depends on it.
  void useSeriesStore.getState().load(storyId);
  const store = useStoryStore.getState();
  store.setActiveStory(story);
  store.setStructure(structure);
  store.setLocations(locations);
  store.setThreads(threads);
  store.setSceneCast(cast);
  store.setCharacters(characters);
  store.setBeatSheets(beatSheets);
  store.setActiveTemplate(templates.find((t) => t.id === story.structure_template_id) ?? null);
  // The side panel's tabs come back with the story; ones whose entity is gone drop out.
  const panel = usePanelStore.getState();
  panel.loadForStory(storyId);
  panel.prune((tab) => {
    if (tab.kind !== "entity") return true;
    if (tab.entityKind === "character") return characters.some((c) => c.id === tab.entityId);
    if (tab.entityKind === "location") return locations.some((l) => l.id === tab.entityId);
    if (tab.entityKind === "thread") return threads.some((t) => t.id === tab.entityId);
    return true;
  });
  return structure;
}
