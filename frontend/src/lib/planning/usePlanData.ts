import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useReloadOnUndo } from "../../hooks/useUndoRedo";
import { useStoryStore } from "../../stores/storyStore";
import { refreshThreads } from "../story/refreshThreads";
import type { PlotThread } from "../../types";
import { methodById, planMethods, sceneLeaves, type PlanData } from "./methods";

/**
 * The story's plan as every surface reads it: the method (beat sheets included), and the
 * data its steps count. Plot threads are fetched only for a method that asks about them.
 */
export function usePlanData() {
  const { activeStory, characters, structure, activeTemplate, beatSheets } = useStoryStore();
  const method = methodById(activeStory?.planning_method, beatSheets);
  const needsThreads = !!method?.steps.some(
    (s) => s.target.kind === "threads" || s.target.kind === "threadPlacement",
  );
  const storyId = activeStory?.id;
  const [threads, setThreads] = useState<PlotThread[] | null>(null);

  const loadThreads = useCallback(() => {
    if (!storyId || !needsThreads) return;
    api
      .listThreads(storyId)
      .then(setThreads)
      .catch(() => setThreads(null));
  }, [storyId, needsThreads]);
  // A change made on the Plan page reaches the story's own copy too (the Lorebook, strip and
  // palette read it, and kept the old threads until a reload; doc 18).
  const reloadThreads = useCallback(() => {
    if (!storyId) return;
    refreshThreads(storyId)
      .then(setThreads)
      .catch(() => setThreads(null));
  }, [storyId]);
  useEffect(() => {
    loadThreads();
  }, [loadThreads]);
  useReloadOnUndo(["plot_thread"], loadThreads);

  const data: PlanData | null = activeStory
    ? { story: activeStory, characters, scenes: sceneLeaves(structure, activeTemplate), threads }
    : null;
  return { data, method, methods: planMethods(beatSheets), threads, setThreads, reloadThreads };
}
